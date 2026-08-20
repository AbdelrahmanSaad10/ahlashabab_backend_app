import 'reflect-metadata';
import { integrationDb } from './db';
import { generateReference } from '../../src/common/utils/reference.util';

/**
 * The database's own guarantee that a slot is held once — T-09's last piece.
 *
 * T-09 proved the *application* refuses a concurrent double-booking: two
 * simultaneous identical requests leave exactly one row, a five-way burst also
 * leaves one. That protection lives in a Serializable transaction inside
 * `BookingsService`, which means it protects the one path that runs through it.
 * A duplicate arriving any other way — a future endpoint, a repair script, a
 * hand-written UPDATE — met nothing at all.
 *
 * The index was left unapplied for a single reason: creating it fails if the
 * table already holds duplicate non-cancelled rows, and production could not be
 * queried. It now can be, read-only, and it holds none.
 *
 * The shape matters as much as the existence. A plain
 * `@@unique([providerId, date, timeSlot])` — the obvious version, and the one
 * originally recommended — would **break cancel-and-rebook**, because a
 * cancelled booking keeps its row. The last test here is the one that would
 * catch that mistake.
 */

const prisma = integrationDb();

const TAG = 'int-slot-constraint';
let providerId: string;
let serviceId: string;
let governorateId: number;

const DATE = new Date('2026-12-15');
const SLOT = '09:30';

const book = (status = 'قيد الانتظار', slot = SLOT) =>
  prisma.booking.create({
    data: {
      reference: generateReference('AS'),
      serviceId,
      providerId,
      applicantName: `${TAG}-applicant`,
      phone: '01055554444',
      age: 33,
      gender: 'أنثى',
      governorateId,
      date: DATE,
      timeSlot: slot,
      status,
    },
  });

const clean = () => prisma.booking.deleteMany({ where: { applicantName: { startsWith: TAG } } });

beforeAll(async () => {
  await prisma.$connect();
  const svc = await prisma.service.findFirst({ where: { active: true } });
  const gov = await prisma.governorate.findFirst();
  serviceId = svc!.id;
  providerId = svc!.providerId;
  governorateId = gov!.id;
  await clean();
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

beforeEach(clean);

describe('a slot cannot be held twice', () => {
  it('refuses a second live booking for the same provider, date and slot', async () => {
    await book();
    // Not through the service — straight at the table, which is exactly the
    // route the Serializable transaction cannot cover.
    await expect(book()).rejects.toThrow();
  });

  it('names the columns, so the failure is diagnosable', async () => {
    // Prisma reports the constrained columns rather than the index name. Either
    // is enough to find this file; asserting on the real message rather than the
    // one I expected keeps the test honest about what an operator will see.
    await book();
    await expect(book()).rejects.toThrow(/provider_id.*date.*time_slot/s);
  });

  it('allows the same slot for a different date', async () => {
    await book();
    const other = await prisma.booking.create({
      data: {
        reference: generateReference('AS'),
        serviceId,
        providerId,
        applicantName: `${TAG}-applicant`,
        phone: '01055554444',
        age: 33,
        gender: 'أنثى',
        governorateId,
        date: new Date('2026-12-16'),
        timeSlot: SLOT,
        status: 'قيد الانتظار',
      },
    });
    expect(other.id).toBeTruthy();
  });

  it('allows a different slot on the same date', async () => {
    await book();
    expect((await book('قيد الانتظار', '10:30')).id).toBeTruthy();
  });
});

describe('cancelling frees the slot', () => {
  it('lets the slot be rebooked after a cancellation', async () => {
    /*
     * The test that decides the shape of the index. A cancelled booking keeps
     * its row, so a plain unique constraint on (provider, date, slot) would
     * reject this rebooking — breaking a working feature in order to guard
     * against one that already works.
     */
    const first = await book();
    await prisma.booking.update({ where: { id: first.id }, data: { status: 'ملغي' } });

    const second = await book();
    expect(second.id).toBeTruthy();

    const rows = await prisma.booking.findMany({
      where: { providerId, date: DATE, timeSlot: SLOT, applicantName: { startsWith: TAG } },
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status !== 'ملغي')).toHaveLength(1);
  });

  it('still refuses a third while the rebooking is live', async () => {
    const first = await book();
    await prisma.booking.update({ where: { id: first.id }, data: { status: 'ملغي' } });
    await book();

    await expect(book()).rejects.toThrow();
  });

  it('allows many cancelled rows for one slot', async () => {
    // Cancellations accumulate; only the live one is constrained.
    for (let i = 0; i < 3; i++) {
      const b = await book();
      await prisma.booking.update({ where: { id: b.id }, data: { status: 'ملغي' } });
    }
    expect((await book()).id).toBeTruthy();
  });
});
