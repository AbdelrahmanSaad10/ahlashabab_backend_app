import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { applyTrustProxy } from '../../src/common/utils/trust-proxy.util';
import { integrationDb } from './db';

/**
 * Rotating an administrator's password — T-06, over real HTTP.
 *
 * The platform shipped with one administrator account, its password hardcoded in
 * a **public** repository's seed and re-applied on every deploy, and **no way to
 * change it**: no endpoint, no dashboard screen, no admin account management at
 * all. The credential was confirmed working against the production API.
 *
 * So this suite covers the endpoint that closes that hole, and in particular the
 * part that is easy to leave out: rotating a password that may already have
 * leaked has to end the sessions it opened, or the attacker keeps their refresh
 * token for another 30 days.
 */

const prisma = integrationDb();

let app: INestApplication;
let base: string;

const TAG = 'int-pwd';
const EMAIL = `${TAG}-admin@test.local`;
const ORIGINAL = 'original-password-9182';
const REPLACEMENT = 'replacement-password-4471';

let adminId: string;

/*
 * Each test gets its own client address.
 *
 * The rate limiter is left fully live — login and change-password allow 5
 * attempts per 10 minutes, and a suite that logs in a dozen times from one
 * address would spend its assertions on 429s. Giving each test a distinct
 * `X-Forwarded-For` is not a workaround: it is the behaviour TRUST_PROXY exists
 * to provide, and it means the limiter is exercised here rather than stubbed
 * out. `clientsShareOneBucket` below leans on the same mechanism to show what
 * production looked like without it.
 */
let clientIp = '';
let ipCounter = 0;
const nextClientIp = () => `198.51.100.${(ipCounter += 1) % 250}`;

const call = (path: string, init: RequestInit = {}, token?: string, ip = clientIp) =>
  fetch(`${base}/api/v1/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Forwarded-For': ip,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

const body = async (res: Response) => {
  const json: any = await res.json().catch(() => ({}));
  return json?.data ?? json;
};

const login = async (password: string) => {
  const res = await call('admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password }),
  });
  return { status: res.status, body: await body(res) };
};

const changePassword = async (
  token: string,
  currentPassword: string,
  newPassword: string,
) =>
  call(
    'admin/auth/change-password',
    { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
    token,
  );

const cleanup = async () => {
  const admins = await prisma.adminUser.findMany({ where: { email: { startsWith: TAG } } });
  for (const a of admins) {
    await prisma.activityLog.deleteMany({ where: { actorId: a.id } });
    await prisma.refreshToken.deleteMany({ where: { adminUserId: a.id } });
  }
  await prisma.adminUser.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.role.deleteMany({ where: { name: { startsWith: TAG } } });
};

/** A fresh admin per test, so ordering can never make one test depend on another. */
const createAdmin = async () => {
  clientIp = nextClientIp();
  await cleanup();
  const role = await prisma.role.create({
    data: {
      name: `${TAG}-role`,
      description: 'password rotation',
      permissionsJson: { bookings: { read: true, write: true } },
    },
  });
  const admin = await prisma.adminUser.create({
    data: {
      email: EMAIL,
      name: 'password admin',
      passwordHash: await argon2.hash(ORIGINAL),
      roleId: role.id,
      active: true,
    },
  });
  adminId = admin.id;
};

beforeAll(async () => {
  await prisma.$connect();

  // The whole production stack: APP_GUARD still registers JwtAuthGuard,
  // RolesGuard and ThrottlerGuard, so every assertion travels the real path.
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  applyTrustProxy(app, '1');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app?.close();
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(createAdmin);

describe('an admin can rotate their own password', () => {
  it('accepts the change and the new password works', async () => {
    const first = await login(ORIGINAL);
    expect(first.status).toBe(200);

    const res = await changePassword(first.body.accessToken, ORIGINAL, REPLACEMENT);
    expect(res.status).toBe(200);

    expect((await login(REPLACEMENT)).status).toBe(200);
  });

  it('the old password stops working', async () => {
    const first = await login(ORIGINAL);
    await changePassword(first.body.accessToken, ORIGINAL, REPLACEMENT);

    expect((await login(ORIGINAL)).status).toBe(401);
  });

  it('every existing session is revoked, not just the current one', async () => {
    // Two separate logins: the second stands in for a session an attacker opened
    // with the leaked password from somewhere else entirely.
    const mine = await login(ORIGINAL);
    const theirs = await login(ORIGINAL);
    expect(theirs.status).toBe(200);

    await changePassword(mine.body.accessToken, ORIGINAL, REPLACEMENT);

    const refreshed = await call('auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: theirs.body.refreshToken }),
    });
    expect(refreshed.status).toBe(401);

    const stored = await prisma.refreshToken.findMany({ where: { adminUserId: adminId } });
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((t) => t.revoked)).toBe(true);
  });
});

describe('the change is refused when it should be', () => {
  it('an unauthenticated caller cannot reach the route', async () => {
    const res = await call('admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: ORIGINAL, newPassword: REPLACEMENT }),
    });
    expect(res.status).toBe(401);
  });

  it('a wrong current password is rejected — a stolen token is not enough', async () => {
    const session = await login(ORIGINAL);
    const res = await changePassword(session.body.accessToken, 'not-the-password', REPLACEMENT);
    expect(res.status).toBe(401);

    expect((await login(ORIGINAL)).status).toBe(200); // unchanged
  });

  it('a short new password is rejected', async () => {
    const session = await login(ORIGINAL);
    const res = await changePassword(session.body.accessToken, ORIGINAL, 'short');
    expect(res.status).toBe(400);
  });

  it('reusing the current password is rejected', async () => {
    const session = await login(ORIGINAL);
    const res = await changePassword(session.body.accessToken, ORIGINAL, ORIGINAL);
    expect(res.status).toBe(400);
  });
});

describe('the change is audited without leaking the passwords', () => {
  it('writes an entry naming the admin, and stores neither password', async () => {
    const session = await login(ORIGINAL);
    await changePassword(session.body.accessToken, ORIGINAL, REPLACEMENT);

    const entries = await prisma.activityLog.findMany({
      where: { actorId: adminId, entityType: 'admin-password' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe(adminId);

    /*
     * `ActivityLogInterceptor` stores `newValue: request.body`, so wiring it to
     * this route would have written both passwords into the activity log in
     * plain text. The entry is written in the service instead — this assertion
     * is what stops someone "fixing" the missing interceptor later.
     */
    const serialised = JSON.stringify(entries[0]);
    expect(serialised).not.toContain(ORIGINAL);
    expect(serialised).not.toContain(REPLACEMENT);
  });
});

describe('the login rate limit is per client, not per platform', () => {
  const login = async (password: string, ip: string) => {
    const res = await call(
      'admin/auth/login',
      { method: 'POST', body: JSON.stringify({ email: EMAIL, password }) },
      undefined,
      ip,
    );
    return res.status;
  };

  it('locks out a brute-force attempt after 5 tries', async () => {
    const attacker = nextClientIp();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push(await login('wrong-password', attacker));

    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  /*
   * The reason this suite trusts a proxy hop at all.
   *
   * `request.ip` is the socket peer unless the proxy chain is trusted, and this
   * deployment answers through Cloudflare and nginx — so before TRUST_PROXY,
   * the five attempts above were shared by *everyone*. Someone mistyping their
   * password five times locked every administrator out of the dashboard for ten
   * minutes, and five OTP requests exhausted the mobile login for the whole user
   * base. This test states the property that fixes it.
   */
  it("a second administrator's login is unaffected by the first's lockout", async () => {
    const attacker = nextClientIp();
    for (let i = 0; i < 6; i++) await login('wrong-password', attacker);
    expect(await login('wrong-password', attacker)).toBe(429);

    // A different address, the correct password: still served.
    expect(await login(ORIGINAL, nextClientIp())).toBe(200);
  });
});
