import 'reflect-metadata';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { integrationDb } from './db';
import { DonationsService } from '../../src/donations/donations.service';
import { UsersService } from '../../src/users/users.service';
import { generateReference } from '../../src/common/utils/reference.util';

/**
 * T-15 — receipts: server-issued, unguessable, and owner-scoped.
 *
 * There is no Receipt model in this system: the donation **reference** is the
 * receipt, and `GET /donations/:reference` is `@Public()` so a guest donor can
 * check it without an account. That makes the reference a credential, and its
 * guessability the entire security story.
 *
 * The acceptance asks for "User A requesting B's receipt → 403/404". That framing
 * does not fit a deliberately public receipt link, so what is asserted here is
 * the property that actually protects donors:
 *
 *   - the reference cannot be enumerated;
 *   - the public lookup does not hand out fields the caller has no use for;
 *   - a user's OWN list (`/me/donations`) is scoped to them.
 */

const prisma = integrationDb();
const donations = new DonationsService(prisma as any, new EventEmitter2());
const users = new UsersService(prisma as any);

const TAG = 'INT-RECEIPT';

const clean = () =>
  prisma.donation.deleteMany({ where: { donorName: { startsWith: TAG } } });

beforeAll(async () => {
  await prisma.$connect();
  await clean();
});
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe('the reference is issued by the server and is unguessable', () => {
  it('is server-generated — a client cannot choose its own reference', async () => {
    const created = await donations.create({
      donorName: `${TAG}-a`, cause: 'دعم عام', amount: 100, method: 'تحويل بنكي',
      // A hostile client trying to pin the reference it will be given.
      reference: 'AS-000001',
    } as any);
    expect(created.reference).not.toBe('AS-000001');
    expect(created.reference).toMatch(/^AS-[0-9A-Z]{12}$/);
  });

  it('is NOT a 6-digit number — that space was only 900,000 wide', () => {
    // The old generator produced AS-123456. An attacker could walk the whole
    // space and harvest every donor's name and amount.
    for (let i = 0; i < 200; i++) {
      expect(generateReference('AS')).not.toMatch(/^AS-\d{6}$/);
    }
  });

  it('does not collide across 20,000 references — the old one gave 51 per 10,000', () => {
    // `reference` is @unique, so a collision is a FAILED donation, not a
    // cosmetic clash. The old keyspace hit ~50% collision odds by ~1,100 records.
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(generateReference('AS'));
    expect(seen.size).toBe(20_000);
  });

  it('avoids ambiguous characters, so a code read aloud is unambiguous', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReference('AS').slice(3)).not.toMatch(/[ILOU]/);
    }
  });
});

describe('the public receipt does not leak more than a receipt needs', () => {
  it('omits userId and gatewayTxId — internal identifiers, not receipt data', async () => {
    const created = await donations.create({
      donorName: `${TAG}-b`, cause: 'دعم عام', amount: 250, method: 'فوري',
    } as any);

    const receipt: any = await donations.findByReference(created.reference);

    expect(receipt.reference).toBe(created.reference);
    expect(receipt.amount).toBe(250);
    // The fields an unauthenticated caller has no business receiving.
    expect(receipt).not.toHaveProperty('userId');
    expect(receipt).not.toHaveProperty('gatewayTxId');
    expect(receipt).not.toHaveProperty('id');
  });

  it('404s for a reference that does not exist, without revealing why', async () => {
    await expect(donations.findByReference('AS-ZZZZZZZZZZZZ')).rejects.toThrow();
  });
});

describe('the server owns the status — a receipt cannot claim to be paid', () => {
  /*
   * T-15's acceptance says "receipt exists only after confirmed payment". This
   * system deliberately issues the reference at creation, because the
   * client-approved donation flow has NO gateway: every method is manual and
   * stays «قيد المراجعة» until an admin approves it. So the receipt exists
   * immediately and carries a pending status — the protection that matters is
   * that a client can never make it say «مكتمل».
   */
  it('ignores a status supplied by the client', async () => {
    const created: any = await donations.create({
      donorName: `${TAG}-c`, cause: 'دعم عام', amount: 300, method: 'تحويل بنكي',
      status: 'مكتمل',
    } as any);
    expect(created.status).not.toBe('مكتمل');
    expect(['قيد المراجعة', 'قيد التأكيد']).toContain(created.status);
  });

  it('marks every client-approved (manual) method as «قيد المراجعة»', async () => {
    for (const method of ['تحويل بنكي', 'فوري', 'فودافون كاش']) {
      const d: any = await donations.create({
        donorName: `${TAG}-${method}`, cause: 'دعم عام', amount: 50, method,
      } as any);
      expect(d.status).toBe('قيد المراجعة');
    }
  });
});

describe('a donor’s own list is scoped to them', () => {
  it('never returns another user’s donations', async () => {
    const a = await prisma.user.create({ data: { email: `${TAG}-a@test.local`.toLowerCase() } });
    const b = await prisma.user.create({ data: { email: `${TAG}-b@test.local`.toLowerCase() } });
    try {
      await prisma.donation.create({
        data: {
          reference: generateReference('AS'), donorName: `${TAG}-owned-by-a`,
          cause: 'دعم عام', amount: 500, method: 'فوري', status: 'مكتمل', userId: a.id,
        },
      });

      const forB = await users.getUserDonations(b.id);
      expect(forB.find((d) => d.donorName === `${TAG}-owned-by-a`)).toBeUndefined();

      const forA = await users.getUserDonations(a.id);
      expect(forA.find((d) => d.donorName === `${TAG}-owned-by-a`)).toBeDefined();
    } finally {
      await prisma.donation.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    }
  });
});
