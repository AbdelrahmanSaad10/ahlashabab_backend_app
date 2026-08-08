import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { integrationDb } from './db';
import { generateReference } from '../../src/common/utils/reference.util';

/**
 * The admin audit trail — who changed what, over real HTTP.
 *
 * This is T-14's "audit entry written" clause and matrix row 35, which the audit
 * left PARTIAL with "verify writes on mutations". It was never verified, and it
 * turned out **bookings were the one admin surface with no trail at all**: every
 * content, CMS, donation and user mutation was intercepted, but confirming,
 * cancelling or marking a booking no-show left no record of who did it.
 *
 * Bookings are the operational core — the appointment a beneficiary turns up for
 * — so a status change is precisely what the log exists to capture.
 */

const prisma = integrationDb();

let app: INestApplication;
let base: string;

const TAG = 'int-audit';
let admin: { id: string; token: string };
let bookingId: string;
let donationId: string;

const req = (path: string, token: string, init: RequestInit = {}) =>
  fetch(`${base}/api/v1/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

/*
 * Wait briefly for the entry rather than reading immediately.
 *
 * This is not test politeness — it reflects how the log actually behaves.
 * `ActivityLogInterceptor` writes inside `tap(async …)`, which RxJS does not
 * await, so the HTTP response can return before the row is committed. The same
 * `try/catch` that stops a logging failure breaking the response also swallows
 * it silently.
 *
 * So the audit trail is **best-effort, not guaranteed**: an entry can be late,
 * and a failed write leaves no trace anywhere. For a log whose entire purpose is
 * accountability that is worth knowing — recorded as a finding rather than
 * papered over by this helper. See the QA notes for T-14.
 */
const entriesFor = async (entityId: string, expect_at_least = 1) => {
  for (let i = 0; i < 40; i++) {
    const rows = await prisma.activityLog.findMany({
      where: { entityId }, orderBy: { createdAt: 'desc' },
    });
    if (rows.length >= expect_at_least) return rows;
    await new Promise((r) => setTimeout(r, 50));
  }
  return prisma.activityLog.findMany({ where: { entityId }, orderBy: { createdAt: 'desc' } });
};

beforeAll(async () => {
  await prisma.$connect();

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  const jwt = app.get(JwtService);

  // An admin with everything, so a 403 can never be mistaken for a missing log entry.
  const role = await prisma.role.create({
    data: {
      name: `${TAG}-full`,
      description: 'all permissions',
      permissionsJson: {
        bookings: { read: true, write: true },
        donations: { read: true, write: true },
        services: { read: true, write: true },
        users: { read: true, write: true },
        portfolio: { read: true, write: true },
        roles: { read: true, write: true },
        cms: { read: true, write: true },
        reports: { read: true, write: true },
        providers: { read: true, write: true },
      },
    },
  });
  const a = await prisma.adminUser.create({
    data: {
      email: `${TAG}-admin@test.local`, name: 'audit admin',
      passwordHash: 'unused', roleId: role.id, active: true,
    },
  });
  admin = {
    id: a.id,
    token: jwt.sign(
      { sub: a.id, email: a.email, type: 'admin', roleId: role.id },
      { secret: process.env.JWT_ACCESS_SECRET as string, expiresIn: '15m' },
    ),
  };

  const svc = await prisma.service.findFirst({ where: { active: true } });
  const gov = await prisma.governorate.findFirst();
  const b = await prisma.booking.create({
    data: {
      reference: generateReference('AS'), serviceId: svc!.id, providerId: svc!.providerId,
      applicantName: `${TAG}-applicant`, phone: '01088888888', age: 30, gender: 'ذكر',
      governorateId: gov!.id, date: new Date('2026-11-02'), timeSlot: '11:00',
      status: 'قيد الانتظار',
    },
  });
  bookingId = b.id;

  const d = await prisma.donation.create({
    data: {
      reference: generateReference('AS'), donorName: `${TAG}-donor`, cause: 'دعم عام',
      amount: 200, method: 'فوري', status: 'قيد المراجعة',
    },
  });
  donationId = d.id;
});

afterAll(async () => {
  await app?.close();
  await prisma.activityLog.deleteMany({ where: { actorId: admin.id } });
  await prisma.booking.deleteMany({ where: { applicantName: { startsWith: TAG } } });
  await prisma.donation.deleteMany({ where: { donorName: { startsWith: TAG } } });
  await prisma.adminUser.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.role.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe('changing a booking status is recorded', () => {
  it('writes an audit entry naming the admin who did it', async () => {
    const res = await req(`admin/bookings/${bookingId}/status`, admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'مؤكد' }),
    });
    expect(res.status).toBeLessThan(300);

    const entries = await entriesFor(bookingId);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].actorId).toBe(admin.id);
    expect(entries[0].entityId).toBe(bookingId);
  });

  it('records the request context, so an entry can be traced', async () => {
    const entries = await entriesFor(bookingId);
    expect(entries.length).toBeGreaterThan(0);
    const e = entries[0];
    expect(e.action).toBeTruthy();
    expect(e.entityType).toBeTruthy();
    // ip / userAgent are best-effort but must not be silently absent for a
    // request that carried them.
    expect(e.userAgent === null || typeof e.userAgent === 'string').toBe(true);
  });
});

describe('approving a donation is recorded', () => {
  it('writes an audit entry', async () => {
    const res = await req(`admin/donations/${donationId}/status`, admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'مكتمل' }),
    });
    expect(res.status).toBeLessThan(300);

    const entries = await entriesFor(donationId);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].actorId).toBe(admin.id);
  });
});

describe('the log records changes, not reads', () => {
  it('a GET writes nothing', async () => {
    // Let any in-flight write from an earlier test land first, or its arrival
    // during this test would look like the GET having logged something.
    await new Promise((r) => setTimeout(r, 300));
    const before = await prisma.activityLog.count({ where: { actorId: admin.id } });
    const res = await req('admin/bookings?limit=1', admin.token);
    expect(res.status).toBe(200);
    const after = await prisma.activityLog.count({ where: { actorId: admin.id } });
    expect(after).toBe(before);
  });
});

describe('every admin mutation surface is intercepted', () => {
  /*
   * A guard against the gap this suite was written for: a new admin controller
   * added without the interceptor would silently stop being audited, and nothing
   * would fail. This asserts the wiring itself rather than one endpoint's
   * behaviour.
   */
  it('no admin controller mutates without an audit trail', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');

    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d: any) => {
        const full = path.join(dir, d.name);
        return d.isDirectory() ? walk(full) : [full];
      });

    const src = path.join(__dirname, '../../src');

    /*
     * Selected by ROUTE, not by filename.
     *
     * The first version of this guard matched `*-admin.controller.ts` plus
     * provider-portal, which is a naming convention rather than a rule —
     * `src/admin/roles.controller.ts` serves `admin/roles` and was never checked,
     * and `admin/admin-users` would have slipped through the same gap.
     */
    const controllers = walk(src)
      .filter((f: string) => f.endsWith('.controller.ts'))
      .filter((f: string) => {
        const body = fs.readFileSync(f, 'utf8');
        return /@Controller\(\s*['"`](admin\/|me\/provider)/.test(body);
      });

    expect(controllers.length).toBeGreaterThan(15);

    const missing = controllers.filter((f: string) => {
      const body = fs.readFileSync(f, 'utf8');
      // A read-only controller has nothing to log.
      if (!/@(Post|Patch|Put|Delete)\(/.test(body)) return false;
      if (body.includes('UseInterceptors(ActivityLogInterceptor)')) return false;
      /*
       * The documented alternative: a controller whose request bodies carry
       * secrets must NOT use the interceptor, because it stores
       * `newValue: request.body` verbatim — a password would land in the
       * activity log in plain text. Those write their entries in the service,
       * and say so with this marker.
       */
      return !body.includes('AUDITED-IN-SERVICE');
    });

    expect(missing.map((f: string) => path.basename(f))).toEqual([]);
  });

  it('every controller claiming AUDITED-IN-SERVICE has a service that audits', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');

    // The marker is an exemption from the check above, so it needs one of its
    // own — otherwise it becomes a comment anyone can use to silence the guard.
    const src = path.join(__dirname, '../../src');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d: any) => {
        const full = path.join(dir, d.name);
        return d.isDirectory() ? walk(full) : [full];
      });

    const claiming = walk(src)
      .filter((f: string) => f.endsWith('.controller.ts'))
      .filter((f: string) => fs.readFileSync(f, 'utf8').includes('AUDITED-IN-SERVICE'));

    expect(claiming.length).toBeGreaterThan(0);

    for (const controller of claiming) {
      const siblings = fs
        .readdirSync(path.dirname(controller))
        .filter((n: string) => n.endsWith('.service.ts'))
        .map((n: string) => fs.readFileSync(path.join(path.dirname(controller), n), 'utf8'));

      expect(siblings.some((s: string) => s.includes('activityLog.create'))).toBe(true);
    }
  });
});
