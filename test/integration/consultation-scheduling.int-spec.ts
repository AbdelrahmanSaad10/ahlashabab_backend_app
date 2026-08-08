import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { integrationDb } from './db';
import { generateReference } from '../../src/common/utils/reference.util';

/**
 * Scheduling a consultation — phase 2 of the consultant portal scope.
 *
 * `consultationsService.schedule()` set `providerId`, `date` and `timeSlot`, and
 * **no controller route exposed it**. Meanwhile `PATCH :id/status` took
 * `@Body('status') status: string` with no validation and wrote whatever it was
 * given, so a request could be marked «تم تحديد موعد» with no provider, no date
 * and no time — a status announcing an appointment that recorded nothing about
 * it — and `{"status":"anything"}` stored "anything".
 *
 * Both halves are covered here: the status route now refuses the value it cannot
 * honour, and the schedule route records all three.
 */

const prisma = integrationDb();

let app: INestApplication;
let base: string;

const TAG = 'int-consult-sched';
let admin: { id: string; token: string };
let providerId: string;

const call = (path: string, init: RequestInit = {}, token?: string) =>
  fetch(`${base}/api/v1/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

const body = async (res: Response) => {
  const json: any = await res.json().catch(() => ({}));
  return json?.data ?? json;
};

const makeRequest = async (status = 'قيد المراجعة') => {
  const row = await prisma.consultationRequest.create({
    data: {
      reference: generateReference('AS'),
      type: 'نفسية',
      name: `${TAG}-applicant`,
      phone: '01011112222',
      email: `${TAG}-${Math.abs(Date.now() % 100000)}@test.local`,
      governorate: 'القاهرة',
      summary: 'تفاصيل الطلب',
      status,
    },
  });
  return row.id;
};

const cleanup = async () => {
  await prisma.consultationRequest.deleteMany({ where: { name: { startsWith: TAG } } });
  if (admin?.id) await prisma.activityLog.deleteMany({ where: { actorId: admin.id } });
  await prisma.adminUser.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.role.deleteMany({ where: { name: { startsWith: TAG } } });
};

beforeAll(async () => {
  await prisma.$connect();
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');

  await cleanup();

  const role = await prisma.role.create({
    data: {
      name: `${TAG}-role`,
      description: 'consultation scheduling',
      permissionsJson: { portfolio: { read: true, write: true } },
    },
  });
  const a = await prisma.adminUser.create({
    data: {
      email: `${TAG}-admin@test.local`,
      name: 'scheduling admin',
      passwordHash: 'unused',
      roleId: role.id,
      active: true,
    },
  });
  admin = {
    id: a.id,
    token: app.get(JwtService).sign(
      { sub: a.id, email: a.email, type: 'admin', roleId: role.id },
      { secret: process.env.JWT_ACCESS_SECRET as string, expiresIn: '15m' },
    ),
  };

  const provider = await prisma.provider.findFirst();
  providerId = provider!.id;
});

afterAll(async () => {
  await app?.close();
  await cleanup();
  await prisma.$disconnect();
});

describe('scheduling records who and when', () => {
  it('assigns the provider, the date and the slot', async () => {
    const id = await makeRequest();

    const res = await call(
      `admin/consultations/${id}/schedule`,
      { method: 'PATCH', body: JSON.stringify({ providerId, date: '2026-11-12', timeSlot: '14:30' }) },
      admin.token,
    );
    expect(res.status).toBe(200);

    const row = await prisma.consultationRequest.findUnique({ where: { id } });
    expect(row!.status).toBe('تم تحديد موعد');
    expect(row!.providerId).toBe(providerId);
    expect(row!.timeSlot).toBe('14:30');
    expect(row!.date?.toISOString().slice(0, 10)).toBe('2026-11-12');
  });

  it('writes an audit entry naming the admin', async () => {
    const id = await makeRequest();
    await call(
      `admin/consultations/${id}/schedule`,
      { method: 'PATCH', body: JSON.stringify({ providerId, date: '2026-11-13', timeSlot: '10:00' }) },
      admin.token,
    );

    // The interceptor writes without awaiting (T-14), so give it a moment.
    let entries: any[] = [];
    for (let i = 0; i < 40 && entries.length === 0; i++) {
      entries = await prisma.activityLog.findMany({ where: { entityId: id } });
      if (entries.length === 0) await new Promise((r) => setTimeout(r, 50));
    }
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].actorId).toBe(admin.id);
  });
});

describe('the status route refuses what it cannot honour', () => {
  it('rejects «تم تحديد موعد» and points at the schedule route', async () => {
    const id = await makeRequest();

    const res = await call(
      `admin/consultations/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'تم تحديد موعد' }) },
      admin.token,
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(await body(res))).toContain('schedule');

    // Nothing moved: the old behaviour set the status and left the appointment blank.
    const row = await prisma.consultationRequest.findUnique({ where: { id } });
    expect(row!.status).toBe('قيد المراجعة');
    expect(row!.providerId).toBeNull();
  });

  it('rejects a status nobody defined', async () => {
    const id = await makeRequest();

    // `@Body('status') status: string` used to write this straight to the column,
    // and every list, filter and badge downstream then held a value from nowhere.
    const res = await call(
      `admin/consultations/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'anything' }) },
      admin.token,
    );
    expect(res.status).toBe(400);
    expect((await prisma.consultationRequest.findUnique({ where: { id } }))!.status).toBe('قيد المراجعة');
  });

  it.each(['جديد', 'قيد المراجعة', 'مكتمل', 'ملغي'])('still accepts «%s»', async (status) => {
    const id = await makeRequest('جديد');
    const res = await call(
      `admin/consultations/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      admin.token,
    );
    expect(res.status).toBe(200);
    expect((await prisma.consultationRequest.findUnique({ where: { id } }))!.status).toBe(status);
  });
});

describe('scheduling is refused when it makes no sense', () => {
  it('an unknown provider is a 400, not a 500 from the foreign key', async () => {
    const id = await makeRequest();
    const res = await call(
      `admin/consultations/${id}/schedule`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          providerId: '00000000-0000-4000-8000-000000000000',
          date: '2026-11-12',
          timeSlot: '14:30',
        }),
      },
      admin.token,
    );
    expect(res.status).toBe(400);
  });

  it('an unknown consultation is a 404', async () => {
    const res = await call(
      'admin/consultations/00000000-0000-4000-8000-000000000000/schedule',
      { method: 'PATCH', body: JSON.stringify({ providerId, date: '2026-11-12', timeSlot: '14:30' }) },
      admin.token,
    );
    expect(res.status).toBe(404);
  });

  it('a cancelled request cannot be given an appointment', async () => {
    const id = await makeRequest('ملغي');
    const res = await call(
      `admin/consultations/${id}/schedule`,
      { method: 'PATCH', body: JSON.stringify({ providerId, date: '2026-11-12', timeSlot: '14:30' }) },
      admin.token,
    );
    expect(res.status).toBe(400);
    expect((await prisma.consultationRequest.findUnique({ where: { id } }))!.status).toBe('ملغي');
  });

  it('a malformed date or slot is rejected', async () => {
    const id = await makeRequest();
    for (const payload of [
      { providerId, date: '12-11-2026', timeSlot: '14:30' },
      { providerId, date: '2026-11-12', timeSlot: '2:30 pm' },
    ]) {
      const res = await call(
        `admin/consultations/${id}/schedule`,
        { method: 'PATCH', body: JSON.stringify(payload) },
        admin.token,
      );
      expect(res.status).toBe(400);
    }
  });
});

describe('authorization', () => {
  it('a guest cannot schedule', async () => {
    const id = await makeRequest();
    const res = await call(`admin/consultations/${id}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ providerId, date: '2026-11-12', timeSlot: '14:30' }),
    });
    expect(res.status).toBe(401);
  });
});
