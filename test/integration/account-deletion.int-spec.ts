import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { integrationDb } from './db';
import { generateReference } from '../../src/common/utils/reference.util';

/**
 * Deleting an account — over real HTTP, against a real database.
 *
 * Google Play requires any app offering account creation to offer deletion, and
 * there was no way to do it: no control in the app, no endpoint but
 * `DELETE /me/favorites`.
 *
 * The tests that matter are not "does it return 200". They are: is the person
 * actually gone, is the **national ID** gone, is the **written description of
 * their circumstances** gone — and did the foundation keep the ledger it needs.
 * Erasure that leaves the sensitive column behind is the failure worth catching.
 */

const prisma = integrationDb();
let app: INestApplication;
let base: string;
let jwt: JwtService;

const TAG = 'int-delete';

const call = (path: string, init: RequestInit = {}, token?: string) =>
  fetch(`${base}/api/v1/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

// Each person books a distinct slot. The first draft gave them all the same one
// and the partial unique index added for T-09 rejected the second — the
// constraint doing exactly its job, on its author.
let slotSeq = 0;

async function seedPerson(suffix: string) {
  const slot = `${String(8 + (slotSeq % 10)).padStart(2, '0')}:00`;
  const day = String(1 + (slotSeq % 27)).padStart(2, '0');
  slotSeq += 1;
  const email = `${TAG}-${suffix}@test.local`;
  const user = await prisma.user.create({
    data: { email, name: `${TAG} person`, phone: '01099990000' },
  });
  const token = jwt.sign(
    { sub: user.id, email, type: 'user' },
    { secret: process.env.JWT_ACCESS_SECRET as string, expiresIn: '15m' },
  );

  const svc = await prisma.service.findFirst({ where: { active: true } });
  const gov = await prisma.governorate.findFirst();

  const booking = await prisma.booking.create({
    data: {
      reference: generateReference('AS'), serviceId: svc!.id, providerId: svc!.providerId,
      applicantName: `${TAG} person`, phone: '01099990000', age: 31, gender: 'ذكر',
      governorateId: gov!.id, date: new Date(`2027-01-${day}`), timeSlot: slot,
      status: 'قيد الانتظار', nationalId: '29001011234567', notes: 'ملاحظات خاصة',
      userId: user.id,
    },
  });
  const donation = await prisma.donation.create({
    data: {
      reference: generateReference('AS'), donorName: `${TAG} person`, cause: 'دعم عام',
      amount: 500, method: 'فوري', status: 'مكتمل', userId: user.id,
    },
  });
  const consultation = await prisma.consultationRequest.create({
    data: {
      reference: generateReference('AS'), type: 'نفسية', name: `${TAG} person`,
      phone: '01099990000', whatsapp: '01099990000', email, age: 31,
      governorate: 'القاهرة', summary: 'وصف بالغ الخصوصية لظروفي الشخصية',
      status: 'جديد', userId: user.id,
    },
  });
  await prisma.deviceToken.create({
    data: { userId: user.id, token: `${TAG}-${suffix}-device`, platform: 'android' },
  });
  await prisma.notification.create({
    data: { userId: user.id, kind: 'system', title: 'ت', body: 'ن' },
  });
  await prisma.otpCode.create({
    data: { email, code: '123456', expiresAt: new Date(Date.now() + 600000) },
  });

  return { user, token, email, booking, donation, consultation };
}

const clean = async () => {
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } } });
  const ids = users.map((u) => u.id);
  await prisma.booking.deleteMany({ where: { OR: [{ userId: { in: ids } }, { applicantName: { contains: TAG } }] } });
  await prisma.donation.deleteMany({ where: { OR: [{ userId: { in: ids } }, { donorName: { contains: TAG } }] } });
  await prisma.consultationRequest.deleteMany({ where: { OR: [{ userId: { in: ids } }, { name: { contains: TAG } }] } });
  await prisma.otpCode.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
};

beforeAll(async () => {
  await prisma.$connect();
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  jwt = app.get(JwtService);
});
afterAll(async () => { await app?.close(); await clean(); await prisma.$disconnect(); });
beforeEach(clean);

describe('the person is gone', () => {
  it('removes the account itself', async () => {
    const p = await seedPerson('a');
    const res = await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);
    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: p.user.id } })).toBeNull();
  });

  it('ends every session, so the token stops working immediately', async () => {
    const p = await seedPerson('b');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);
    expect((await call('me', {}, p.token)).status).toBe(401);
  });

  it('takes the device tokens, notifications and unused login codes with it', async () => {
    const p = await seedPerson('c');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);
    expect(await prisma.deviceToken.count({ where: { userId: p.user.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: p.user.id } })).toBe(0);
    expect(await prisma.otpCode.count({ where: { email: p.email } })).toBe(0);
  });

  it('frees the email address for re-registration', async () => {
    const p = await seedPerson('d');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);
    const again = await prisma.user.create({ data: { email: p.email } });
    expect(again.id).not.toBe(p.user.id);
  });
});

describe('the sensitive columns are actually erased', () => {
  it('erases the national ID from the booking', async () => {
    const p = await seedPerson('e');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);

    const b = await prisma.booking.findUnique({ where: { id: p.booking.id } });
    expect(b!.nationalId).toBeNull();
    expect(b!.notes).toBeNull();
    expect(b!.applicantName).not.toContain(TAG);
    expect(b!.phone).not.toBe('01099990000');
    expect(b!.userId).toBeNull();
  });

  it('erases the written description of the person’s circumstances', async () => {
    /*
     * `ConsultationRequest.summary` is the most sensitive column in the schema —
     * a person's own account of their situation. An erasure that anonymises the
     * name and leaves this behind has not erased anything that matters.
     */
    const p = await seedPerson('f');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);

    const c = await prisma.consultationRequest.findUnique({ where: { id: p.consultation.id } });
    expect(c!.summary).toBeNull();
    expect(c!.whatsapp).toBeNull();
    expect(c!.age).toBeNull();
    expect(c!.name).not.toContain(TAG);
    expect(c!.email).not.toBe(p.email);
  });

  it('leaves nothing identifying anywhere in the retained rows', async () => {
    const p = await seedPerson('g');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);

    const rows = JSON.stringify([
      await prisma.booking.findUnique({ where: { id: p.booking.id } }),
      await prisma.donation.findUnique({ where: { id: p.donation.id } }),
      await prisma.consultationRequest.findUnique({ where: { id: p.consultation.id } }),
    ]);
    for (const trace of ['29001011234567', '01099990000', p.email, 'ملاحظات خاصة', 'وصف بالغ الخصوصية']) {
      expect(rows).not.toContain(trace);
    }
  });
});

describe('the foundation keeps what it legitimately needs', () => {
  it('keeps the donation as a ledger entry, without the donor', async () => {
    const p = await seedPerson('h');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);

    const d = await prisma.donation.findUnique({ where: { id: p.donation.id } });
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(500);
    expect(d!.method).toBe('فوري');
    expect(d!.reference).toBe(p.donation.reference);
    expect(d!.donorName).not.toContain(TAG);
    expect(d!.userId).toBeNull();
  });

  it('keeps the booking, so the slot’s history stays intact', async () => {
    const p = await seedPerson('i');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, p.token);

    const b = await prisma.booking.findUnique({ where: { id: p.booking.id } });
    expect(b).not.toBeNull();
    expect(b!.timeSlot).toBe(p.booking.timeSlot);
    expect(b!.status).toBe('قيد الانتظار');
  });
});

describe('it cannot happen by accident', () => {
  it('refuses without the explicit confirmation', async () => {
    const p = await seedPerson('j');
    const res = await call('me', { method: 'DELETE', body: JSON.stringify({}) }, p.token);
    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: p.user.id } })).not.toBeNull();
  });

  it('refuses a wrong confirmation value', async () => {
    const p = await seedPerson('k');
    const res = await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'yes' }) }, p.token);
    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: p.user.id } })).not.toBeNull();
  });

  it('refuses a guest outright', async () => {
    const res = await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });
    expect(res.status).toBe(401);
  });

  it('cannot reach anyone else’s account', async () => {
    const a = await seedPerson('l');
    const b = await seedPerson('m');
    await call('me', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }, a.token);
    // The route takes no id — it can only ever delete the caller.
    expect(await prisma.user.findUnique({ where: { id: b.user.id } })).not.toBeNull();
  });
});
