import 'reflect-metadata';
import { integrationDb } from './db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingsService } from '../../src/bookings/bookings.service';

/**
 * Double-booking under concurrency — the T-09 proof.
 *
 * T-09 was filed as depending on T-06, but that was a misreading: proving a race
 * needs a *database*, not credentials. With a disposable Postgres it can be run
 * here, today.
 *
 * `BookingsService.create` guards the slot with a read-then-write inside a
 * SERIALIZABLE transaction, and there is **no** `@@unique([providerId, date,
 * timeSlot])` in the schema — only an index — so that isolation level is the
 * only thing standing between two simultaneous requests and a double-booked
 * provider. This fires both at once and asserts what actually happens.
 */

const prisma = integrationDb();
const service = new BookingsService(prisma as any, new EventEmitter2());

const PHONE_A = '01000000001';
const PHONE_B = '01000000002';
const DATE = '2026-09-15';
const SLOT = '10:00';

let serviceId: string;
let providerId: string;
let governorateId: number;

/*
 * Clean by SLOT, not by phone. An earlier version deleted only PHONE_A/PHONE_B
 * and left the burst test's rows behind, so a second run of the suite found the
 * slot already taken and every test failed — a self-inflicted flake that looked
 * exactly like a regression in the booking guard.
 */
const clean = () =>
  prisma.booking.deleteMany({ where: { providerId, date: new Date(DATE), timeSlot: SLOT } });

beforeAll(async () => {
  await prisma.$connect();
  const svc = await prisma.service.findFirst({ where: { active: true }, include: { provider: true } });
  if (!svc) throw new Error('No seeded service — run `prisma db seed` against the test database first.');
  serviceId = svc.id;
  providerId = svc.providerId;
  await prisma.provider.update({ where: { id: providerId }, data: { active: true, acceptingBookings: true } });
  const gov = await prisma.governorate.findFirst();
  governorateId = gov!.id;
  await clean();
});

afterEach(clean);

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

const payload = (phone: string) => ({
  serviceId,
  governorateId,
  applicantName: 'اختبار التزامن',
  phone,
  age: 30,
  gender: 'ذكر' as const,
  date: DATE,
  timeSlot: SLOT,
});

describe('booking slot conflicts', () => {
  it('rejects a second booking for a slot already taken (sequential)', async () => {
    await service.create(payload(PHONE_A) as any);
    await expect(service.create(payload(PHONE_B) as any)).rejects.toMatchObject({
      response: { error: { code: 'SLOT_TAKEN' } },
    });

    const rows = await prisma.booking.count({ where: { providerId, date: new Date(DATE), timeSlot: SLOT } });
    expect(rows).toBe(1);
  });

  it('lets the slot be re-used once the holder cancels', async () => {
    const first = await service.create(payload(PHONE_A) as any);
    await prisma.booking.update({ where: { id: first.id }, data: { status: 'ملغي' } });
    await expect(service.create(payload(PHONE_B) as any)).resolves.toBeDefined();
  });

  /**
   * The real test: two requests for the same slot, in flight together.
   *
   * Whatever the error shape, the invariant that matters is that the database
   * ends with exactly ONE booking. A provider double-booked for one slot means
   * two people arrive for the same appointment.
   */
  it('never lets both of two simultaneous requests win', async () => {
    const results = await Promise.allSettled([
      service.create(payload(PHONE_A) as any),
      service.create(payload(PHONE_B) as any),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    const rows = await prisma.booking.count({
      where: { providerId, date: new Date(DATE), timeSlot: SLOT, status: { not: 'ملغي' } },
    });

    // Surface what the loser actually got — the point of running this for real.
    if (rejected.length) {
      const r: any = rejected[0].reason;
      // eslint-disable-next-line no-console
      console.log('loser rejected with:', r?.response?.error?.code ?? r?.code ?? r?.name ?? String(r).slice(0, 120));
    }

    expect(rows).toBe(1);
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('turns a Postgres serialization failure into 409 SLOT_TAKEN, not a 500', async () => {
    // Under heavier concurrency Postgres aborts the loser with a serialization
    // failure (Prisma P2034) rather than letting it see the winner's row. That
    // used to reach the client as a 500 — "the server broke" — when the truth is
    // simply that the slot was taken. Simulate the abort at the boundary.
    const svc: any = new BookingsService(
      { ...(prisma as any), $transaction: async () => { const e: any = new Error('write conflict'); e.code = 'P2034'; throw e; } },
      new EventEmitter2(),
    );
    await expect(svc.create(payload(PHONE_A))).rejects.toMatchObject({
      response: { error: { code: 'SLOT_TAKEN' } },
    });
  });

  it('holds under a burst of five simultaneous requests for one slot', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => service.create(payload(`010000000${i}0`) as any)),
    );
    const rows = await prisma.booking.count({
      where: { providerId, date: new Date(DATE), timeSlot: SLOT, status: { not: 'ملغي' } },
    });
    expect(rows).toBe(1);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
