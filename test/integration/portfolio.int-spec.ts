import 'reflect-metadata';
import { integrationDb } from './db';
import { PortfolioService } from '../../src/portfolio/portfolio.service';

/**
 * Portfolio — the publish/draft boundary, against a real database.
 *
 * `portfolio.service.ts` had **0% coverage** and 87 statements. The property
 * worth protecting is not CRUD mechanics: it is that **unpublished content stays
 * invisible**. For this client that is a privacy control, not a convenience —
 * humanitarian cases carry beneficiary details, the editor labels images
 * "privacy-vetted" and deliberately stores only a governorate "بدون عنوان
 * تفصيلي — خصوصية المستفيد". Unpublishing is how a case gets taken down when a
 * family withdraws consent or a detail turns out to be wrong.
 */

const prisma = integrationDb();
const portfolio = new PortfolioService(prisma as any);

const TAG = 'INT-PORTFOLIO';

let draftCaseId: string;
let publishedCaseId: string;
let draftProjectId: string;

const clean = async () => {
  await prisma.case.deleteMany({ where: { title: { startsWith: TAG } } });
  await prisma.project.deleteMany({ where: { title: { startsWith: TAG } } });
};

beforeAll(async () => {
  await prisma.$connect();
  await clean();

  const draft = await prisma.case.create({
    data: {
      code: `${TAG}-D`, title: `${TAG}-draft`, summary: 'sensitive, not for publication',
      need: 'beneficiary details', targetAmount: 1000, raisedAmount: 0,
      tag: 'عاجل', location: 'القاهرة، مصر', published: false,
    },
  });
  draftCaseId = draft.id;

  const live = await prisma.case.create({
    data: {
      code: `${TAG}-P`, title: `${TAG}-published`, summary: 'public', need: 'n',
      targetAmount: 2000, raisedAmount: 0, tag: 'عاجل', location: 'القاهرة، مصر',
      published: true,
    },
  });
  publishedCaseId = live.id;

  const dp = await prisma.project.create({
    data: {
      title: `${TAG}-draft-project`, description: 'unreleased', category: 'صحة',
      targetAmount: 5000, raisedAmount: 0, published: false,
    },
  });
  draftProjectId = dp.id;
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe('public lists show only published items', () => {
  it('a draft case is absent from the published list', async () => {
    const res: any = await portfolio.findAllCases({ published: true, limit: 100 });
    const ids = res.data.map((c: any) => c.id);
    expect(ids).toContain(publishedCaseId);
    expect(ids).not.toContain(draftCaseId);
  });

  it('a draft project is absent from the published list', async () => {
    const res: any = await portfolio.findAllProjects({ published: true, limit: 100 });
    expect(res.data.map((p: any) => p.id)).not.toContain(draftProjectId);
  });

  it('an admin listing without the filter still sees drafts', async () => {
    const res: any = await portfolio.findAllCases({ limit: 100 });
    expect(res.data.map((c: any) => c.id)).toContain(draftCaseId);
  });
});

describe('the detail route must not leak a draft', () => {
  /*
   * `GET /portfolio/cases/:id` and `/projects/:id` are @Public(). The LIST routes
   * pass `published: true`; the DETAIL routes passed nothing, so an unpublished
   * case was fully readable by anyone holding its id — including the id of a case
   * that was published once and then taken down. Ids are UUIDs, so this is not
   * enumerable, but "unpublish" has to actually remove access or it is not a
   * takedown at all.
   */
  it('a draft case is NOT readable through the public detail path', async () => {
    await expect(portfolio.findPublishedCaseById(draftCaseId)).rejects.toThrow();
  });

  it('a draft project is NOT readable through the public detail path', async () => {
    await expect(portfolio.findPublishedProjectById(draftProjectId)).rejects.toThrow();
  });

  it('a published case IS readable publicly', async () => {
    const item: any = await portfolio.findPublishedCaseById(publishedCaseId);
    expect(item.id).toBe(publishedCaseId);
  });

  it('an admin can still read the draft through the admin path', async () => {
    const item: any = await portfolio.findCaseById(draftCaseId);
    expect(item.id).toBe(draftCaseId);
  });
});

describe('taking content down actually removes access', () => {
  it('unpublishing a case hides it from both the list and the detail route', async () => {
    // The takedown path: a case is live, then has to come down.
    await prisma.case.update({ where: { id: publishedCaseId }, data: { published: false } });
    try {
      const res: any = await portfolio.findAllCases({ published: true, limit: 100 });
      expect(res.data.map((c: any) => c.id)).not.toContain(publishedCaseId);
      await expect(portfolio.findPublishedCaseById(publishedCaseId)).rejects.toThrow();
    } finally {
      await prisma.case.update({ where: { id: publishedCaseId }, data: { published: true } });
    }
  });
});

describe('fundraising totals are entered by hand — nothing derives them', () => {
  /*
   * `raisedAmount` is set by whoever creates or edits the case. Nothing computes
   * it: `donation.completed` is consumed only by notifications, and a Donation
   * carries a free-text `cause`, not a `caseId`, so there is no link from money
   * received to the progress bar the app shows.
   *
   * This test documents that, rather than asserting a derivation that does not
   * exist. See the QA notes — it also means the T-02 decision to stop sending
   * `raisedAmount` from the dashboard removed the ONLY way to update it.
   */
  it('stores the raisedAmount it is given', async () => {
    const created: any = await portfolio.createCase({
      code: `${TAG}-RA`, title: `${TAG}-raised`, summary: 's', need: 'n',
      targetAmount: 1000, raisedAmount: 250, tag: 'عاجل',
      location: 'القاهرة، مصر', published: false,
    } as any);
    expect(created.raisedAmount).toBe(250);
  });

  it('a completed donation does NOT move any case total', async () => {
    const before: any = await portfolio.createCase({
      code: `${TAG}-LINK`, title: `${TAG}-link`, summary: 's', need: 'n',
      targetAmount: 1000, raisedAmount: 0, tag: 'عاجل',
      location: 'القاهرة، مصر', published: true,
    } as any);

    await prisma.donation.create({
      data: {
        reference: `${TAG}-DON`, donorName: `${TAG}-donor`, cause: `${TAG}-link`,
        amount: 400, method: 'فوري', status: 'مكتمل',
      },
    });

    const after = await prisma.case.findUnique({ where: { id: before.id } });
    // Documents the gap: the donation is completed, the progress bar is still 0.
    expect(after!.raisedAmount).toBe(0);

    await prisma.donation.deleteMany({ where: { reference: { startsWith: TAG } } });
  });
});
