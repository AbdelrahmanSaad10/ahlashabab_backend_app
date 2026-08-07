import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { integrationDb } from './db';

/**
 * T-08 — the authorization suite, over real HTTP.
 *
 * This was filed as blocked on T-06 ("one admin + two user tokens"). That was a
 * misreading, the third of its kind: T-06 is about **external** services — SMTP,
 * a payment sandbox, an FCM key. Tokens are not external. This suite owns the
 * test database and the JWT secret, so it can create its own users and admins
 * and sign its own tokens. Nothing here needs a staging environment.
 *
 * The whole app is booted — `APP_GUARD` registers `JwtAuthGuard` and `RolesGuard`
 * globally, so requests go through the same authorization stack production uses,
 * with the same `api/v1` prefix. Assertions are on real HTTP status codes.
 */

const prisma = integrationDb();

let app: INestApplication;
let base: string;
let jwt: JwtService;

const TAG = 'int-authz';
let userA: { id: string; token: string };
let userB: { id: string; token: string };
let limitedAdmin: { id: string; token: string };
let blockedUser: { id: string; token: string };

/*
 * Sign a token the app's own strategy will accept.
 *
 * The secret is passed explicitly because `JwtModule` here is registered without
 * a default — `AuthService` supplies it per call — so `jwt.sign(payload)` alone
 * throws "secretOrPrivateKey must have a value". This is the same
 * `JWT_ACCESS_SECRET` the access strategy verifies with, so these are genuine
 * tokens, not a bypass.
 */
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const sign = (payload: Record<string, unknown>) =>
  jwt.sign(payload, { secret: ACCESS_SECRET, expiresIn: '15m' });

const req = (path: string, token?: string, init: RequestInit = {}) =>
  fetch(`${base}/api/v1/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

beforeAll(async () => {
  await prisma.$connect();

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  jwt = app.get(JwtService);

  const mk = async (suffix: string, blocked = false) => {
    const u = await prisma.user.create({
      data: { email: `${TAG}-${suffix}@test.local`, name: `${TAG}-${suffix}`, blocked },
    });
    return { id: u.id, token: sign({ sub: u.id, email: u.email, type: 'user' }) };
  };

  userA = await mk('a');
  userB = await mk('b');
  blockedUser = await mk('blocked', true);

  // An admin whose role grants ONLY portfolio:read — everything else must 403.
  const role = await prisma.role.create({
    data: {
      name: `${TAG}-limited`,
      description: 'read portfolio only',
      permissionsJson: { portfolio: { read: true, write: false } },
    },
  });
  const admin = await prisma.adminUser.create({
    data: {
      email: `${TAG}-admin@test.local`,
      name: 'limited admin',
      passwordHash: 'not-used-these-tests-sign-directly',
      roleId: role.id,
      active: true,
    },
  });
  limitedAdmin = {
    id: admin.id,
    token: sign({ sub: admin.id, email: admin.email, type: 'admin', roleId: role.id }),
  };
});

afterAll(async () => {
  await app?.close();
  await prisma.adminUser.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.role.deleteMany({ where: { name: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe('a guest is refused everywhere private', () => {
  const meRoutes = [
    'me',
    'me/bookings',
    'me/donations',
    'me/favorites',
    'me/notifications',
    'me/notification-preferences',
    'me/consultations',
  ];

  it.each(meRoutes)('GET /%s without a token → 401', async (path) => {
    expect((await req(path)).status).toBe(401);
  });

  const adminRoutes = [
    'admin/bookings',
    'admin/donations',
    'admin/users',
    'admin/roles',
    'admin/activity',
    'admin/portfolio/cases',
    'admin/providers',
  ];

  it.each(adminRoutes)('GET /%s without a token → 401', async (path) => {
    expect((await req(path)).status).toBe(401);
  });

  it('a forged token signed with the wrong secret is refused', async () => {
    const forged = new JwtService({ secret: 'not-the-real-secret' }).sign(
      { sub: userA.id, email: 'x', type: 'user' },
      { expiresIn: '15m' },
    );
    expect((await req('me', forged)).status).toBe(401);
  });

  it('an expired token is refused', async () => {
    const expired = jwt.sign({ sub: userA.id, email: 'x', type: 'user' }, { secret: ACCESS_SECRET, expiresIn: '-1s' });
    expect((await req('me', expired)).status).toBe(401);
  });
});

describe('a user token cannot act as an admin', () => {
  const adminRoutes = ['admin/bookings', 'admin/donations', 'admin/users', 'admin/roles'];

  it.each(adminRoutes)('user token on /%s → 401 or 403, never 200', async (path) => {
    const res = await req(path, userA.token);
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it('cannot self-promote by claiming type:admin in the token', async () => {
    // The payload is signed with the real secret, but `sub` is a user id, so the
    // strategy's adminUser lookup finds nothing.
    const forgedAdmin = sign({ sub: userA.id, email: 'x', type: 'admin', roleId: 'whatever' });
    const res = await req('admin/users', forgedAdmin);
    expect([401, 403]).toContain(res.status);
  });
});

describe('an admin is refused modules outside its role matrix', () => {
  it('reaches the module it IS granted (portfolio:read)', async () => {
    const res = await req('admin/portfolio/cases', limitedAdmin.token);
    expect(res.status).toBe(200);
  });

  const forbidden = ['admin/users', 'admin/roles', 'admin/donations', 'admin/bookings'];

  it.each(forbidden)('403 on /%s — outside its matrix', async (path) => {
    const res = await req(path, limitedAdmin.token);
    expect(res.status).toBe(403);
  });

  it('403 on a WRITE to the module it may only read', async () => {
    const res = await req('admin/portfolio/cases', limitedAdmin.token, {
      method: 'POST',
      body: JSON.stringify({ title: 'x', summary: 'y' }),
    });
    // Must be refused by the permission guard, not by validation.
    expect(res.status).toBe(403);
  });
});

describe('a blocked user cannot use a still-valid token', () => {
  it('401 on /me even though the token itself is fine', async () => {
    expect((await req('me', blockedUser.token)).status).toBe(401);
  });
});

describe('IDOR — one user cannot read another’s records', () => {
  let bookingOfB: string;
  let donationOfB: string;

  beforeAll(async () => {
    const svc = await prisma.service.findFirst({ where: { active: true } });
    const gov = await prisma.governorate.findFirst();
    const b = await prisma.booking.create({
      data: {
        reference: `${TAG}-BK`, serviceId: svc!.id, providerId: svc!.providerId,
        userId: userB.id, applicantName: 'B', phone: '01099999999', age: 30,
        gender: 'ذكر', governorateId: gov!.id, date: new Date('2026-10-01'),
        timeSlot: '09:00', status: 'قيد الانتظار',
      },
    });
    bookingOfB = b.id;
    const d = await prisma.donation.create({
      data: {
        reference: `${TAG}-DN`, donorName: 'B', cause: 'دعم عام', amount: 100,
        method: 'فوري', status: 'مكتمل', userId: userB.id,
      },
    });
    donationOfB = d.id;
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { reference: { startsWith: TAG } } });
    await prisma.donation.deleteMany({ where: { reference: { startsWith: TAG } } });
  });

  it('A’s /me/bookings never contains B’s booking', async () => {
    const res = await req('me/bookings', userA.token);
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain(bookingOfB);
    expect(body).not.toContain('01099999999');
  });

  it('A’s /me/donations never contains B’s donation', async () => {
    const res = await req('me/donations', userA.token);
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain(donationOfB);
  });

  it('B sees their own records — proving the check above is meaningful', async () => {
    const bookings = JSON.stringify(await (await req('me/bookings', userB.token)).json());
    const donations = JSON.stringify(await (await req('me/donations', userB.token)).json());
    expect(bookings).toContain(bookingOfB);
    expect(donations).toContain(donationOfB);
  });
});
