import 'reflect-metadata';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { integrationDb } from './db';
import { DonationsService } from '../../src/donations/donations.service';
import { PortfolioService } from '../../src/portfolio/portfolio.service';

/**
 * T-20 — approved donations move the fundraising total the app shows.
 *
 * Before this, nothing derived `raisedAmount`: `donation.completed` fed only
 * notifications, and a Donation carried a free-text `cause` with no link to a
 * case. A donor gave to a case and the progress bar never moved.
 *
 * The credit is an **increment**, deliberately not a recompute: existing
 * hand-entered totals survive as the starting point, so no backfill is needed and
 * no historical figure is destroyed. The status change and the credit share one
 * transaction — a donation marked approved while its case total silently failed
 * to move would be worse than either failure alone.
 */

const prisma = integrationDb();
const donations = new DonationsService(prisma as any, new EventEmitter2());
const portfolio = new PortfolioService(prisma as any);

const TAG = 'INT-RAISED';
const ADMIN = 'admin-under-test';

let caseId: string;
let projectId: string;

const clean = async () => {
  await prisma.donation.deleteMany({ where: { donorName: { startsWith: TAG } } });
  await prisma.case.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.project.deleteMany({ where: { title: { startsWith: TAG } } });
};

beforeAll(async () => {
  await prisma.$connect();
  await clean();
});
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clean();
  // Starts at 1000 — a hand-entered historical total, which must survive.
  const c = await prisma.case.create({
    data: {
      code: `${TAG}-C`, title: `${TAG}-case`, summary: 's', need: 'n',
      targetAmount: 10_000, raisedAmount: 1000, supporters: 5,
      tag: 'عاجل', location: 'القاهرة، مصر', published: true,
    },
  });
  caseId = c.id;
  const p = await prisma.project.create({
    data: {
      title: `${TAG}-project`, description: 'd', category: 'صحة',
      targetAmount: 20_000, raisedAmount: 0, published: true,
    },
  });
  projectId = p.id;
});

const give = async (amount: number, link: { caseId?: string; projectId?: string }) =>
  donations.create({
    donorName: `${TAG}-donor`, cause: 'دعم عام', amount, method: 'فوري', ...link,
  } as any);

const caseNow = () => prisma.case.findUnique({ where: { id: caseId } });

describe('approving a donation credits the case it was given for', () => {
  it('adds the amount and one supporter', async () => {
    const d: any = await give(250, { caseId });
    await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);

    const after = await caseNow();
    expect(after!.raisedAmount).toBe(1250); // 1000 hand-entered + 250
    expect(after!.supporters).toBe(6);
  });

  it('preserves the hand-entered starting total — no backfill, no data loss', async () => {
    const before = await caseNow();
    expect(before!.raisedAmount).toBe(1000);

    const d: any = await give(500, { caseId });
    await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);

    // An increment, not a recompute: a recompute would have wiped the 1000.
    expect((await caseNow())!.raisedAmount).toBe(1500);
  });

  it('credits a project the same way', async () => {
    const d: any = await give(750, { projectId });
    await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);
    const after = await prisma.project.findUnique({ where: { id: projectId } });
    expect(after!.raisedAmount).toBe(750);
    expect(after!.supporters).toBe(1);
  });

  it('accumulates across several donors', async () => {
    for (const amount of [100, 200, 300]) {
      const d: any = await give(amount, { caseId });
      await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);
    }
    const after = await caseNow();
    expect(after!.raisedAmount).toBe(1600); // 1000 + 600
    expect(after!.supporters).toBe(8);
  });
});

describe('money that is not approved does not count', () => {
  it('a pending donation moves nothing', async () => {
    await give(400, { caseId });
    expect((await caseNow())!.raisedAmount).toBe(1000);
  });

  it('a rejected donation moves nothing', async () => {
    const d: any = await give(400, { caseId });
    await donations.adminUpdateStatus(d.id, 'فشل', ADMIN);
    expect((await caseNow())!.raisedAmount).toBe(1000);
  });

  it('a general donation with no link moves nothing', async () => {
    const d: any = await give(999, {});
    await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);
    expect((await caseNow())!.raisedAmount).toBe(1000);
  });
});

describe('a donation cannot be counted twice', () => {
  it('re-approving an already-approved donation is refused', async () => {
    const d: any = await give(300, { caseId });
    await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);
    expect((await caseNow())!.raisedAmount).toBe(1300);

    // «مكتمل» is a final state — the transition is refused, so no second credit.
    await expect(donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN)).rejects.toThrow();
    expect((await caseNow())!.raisedAmount).toBe(1300);
  });
});

describe('a deleted case detaches its donations rather than orphaning them', () => {
  /*
   * The foreign key is `onDelete: SetNull`, so removing a case clears `caseId`
   * on its donations instead of failing or leaving a dangling reference. That is
   * why the credit inside the transaction cannot fail on a missing case — an
   * earlier draft of this test tried to force that failure and could not, which
   * is the schema doing its job.
   *
   * The consequence worth knowing: a donation whose case was deleted before
   * approval credits nothing, and the money is recorded but attributed to no
   * case.
   */
  it('clears the link and credits nothing on approval', async () => {
    const d: any = await give(500, { caseId });
    await prisma.case.delete({ where: { id: caseId } });

    const detached = await prisma.donation.findUnique({ where: { id: d.id } });
    expect(detached!.caseId).toBeNull();

    await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);
    const after = await prisma.donation.findUnique({ where: { id: d.id } });
    expect(after!.status).toBe('مكتمل');
  });
});

describe('the public case reflects the new total', () => {
  it('the published detail shows the credited amount', async () => {
    const d: any = await give(1500, { caseId });
    await donations.adminUpdateStatus(d.id, 'مكتمل', ADMIN);
    const item: any = await portfolio.findPublishedCaseById(caseId);
    expect(item.raisedAmount).toBe(2500);
  });
});
