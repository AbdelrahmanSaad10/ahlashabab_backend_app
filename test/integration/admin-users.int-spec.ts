import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { applyTrustProxy } from '../../src/common/utils/trust-proxy.util';
import { integrationDb } from './db';

/**
 * Administrator accounts, over real HTTP.
 *
 * There was no way to create, list, disable or reset one. The foundation ran on a
 * single account whose password came from the seed, a second could not be made
 * through the product, and someone who left could not be locked out except by
 * hand on the database.
 *
 * The tests that matter most here are the refusals. An account management screen
 * that lets the last administrator disable themselves, or move themselves to a
 * role that cannot manage accounts, has simply relocated the lockout — the only
 * way back would be psql, which is the thing this module exists to end.
 */

const prisma = integrationDb();

let app: INestApplication;
let base: string;
let jwt: JwtService;

const TAG = 'int-adminusers';
const PASSWORD = 'a-perfectly-fine-password';

let superRoleId: string;
let weakRoleId: string;
let owner: { id: string; token: string };

let clientIp = '';
let ipCounter = 0;
const nextClientIp = () => `203.0.113.${(ipCounter += 1) % 250}`;

const call = (path: string, init: RequestInit = {}, token?: string) =>
  fetch(`${base}/api/v1/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-Forwarded-For': clientIp,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

const body = async (res: Response) => {
  const json: any = await res.json().catch(() => ({}));
  return json?.data ?? json;
};

const tokenFor = (id: string, email: string, roleId: string) =>
  jwt.sign(
    { sub: id, email, type: 'admin', roleId },
    { secret: process.env.JWT_ACCESS_SECRET as string, expiresIn: '15m' },
  );

const makeAdmin = async (suffix: string, roleId: string, active = true) => {
  const email = `${TAG}-${suffix}@test.local`;
  const created = await prisma.adminUser.create({
    data: {
      name: `admin ${suffix}`,
      email,
      passwordHash: await argon2.hash(PASSWORD),
      roleId,
      active,
    },
  });
  return { id: created.id, email, token: tokenFor(created.id, email, roleId) };
};

const cleanup = async () => {
  const admins = await prisma.adminUser.findMany({ where: { email: { startsWith: TAG } } });
  for (const a of admins) {
    await prisma.activityLog.deleteMany({ where: { actorId: a.id } });
    await prisma.refreshToken.deleteMany({ where: { adminUserId: a.id } });
  }
  await prisma.adminUser.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.role.deleteMany({ where: { name: { startsWith: TAG } } });
};

beforeAll(async () => {
  await prisma.$connect();
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  applyTrustProxy(app, '1');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  jwt = app.get(JwtService);
});

afterAll(async () => {
  await app?.close();
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  clientIp = nextClientIp();
  await cleanup();

  const superRole = await prisma.role.create({
    data: {
      name: `${TAG}-super`,
      description: 'can manage roles and accounts',
      permissionsJson: { roles: { read: true, write: true }, users: { read: true, write: true } },
    },
  });
  superRoleId = superRole.id;

  const weakRole = await prisma.role.create({
    data: {
      name: `${TAG}-weak`,
      description: 'cannot manage roles',
      permissionsJson: { roles: { read: true, write: false }, bookings: { read: true, write: true } },
    },
  });
  weakRoleId = weakRole.id;

  owner = await makeAdmin('owner', superRoleId);
  // A second manager, so the "last manager" rule is not tripped by every test.
  await makeAdmin('second-manager', superRoleId);
});

describe('creating an account', () => {
  it('creates one that can actually log in', async () => {
    const res = await call(
      'admin/admin-users',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'new colleague',
          email: `${TAG}-new@test.local`,
          password: 'another-fine-password',
          roleId: weakRoleId,
        }),
      },
      owner.token,
    );
    expect(res.status).toBe(201);

    const login = await call('admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `${TAG}-new@test.local`, password: 'another-fine-password' }),
    });
    expect(login.status).toBe(200);
    expect((await body(login)).accessToken).toBeTruthy();
  });

  it('never returns a password hash', async () => {
    const res = await call(
      'admin/admin-users',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'no hash please',
          email: `${TAG}-nohash@test.local`,
          password: 'another-fine-password',
          roleId: weakRoleId,
        }),
      },
      owner.token,
    );
    const created = await body(res);
    expect(JSON.stringify(created)).not.toContain('passwordHash');
    expect(JSON.stringify(created)).not.toContain('another-fine-password');

    const list = await body(await call('admin/admin-users', {}, owner.token));
    expect(JSON.stringify(list)).not.toContain('passwordHash');
  });

  it('refuses a duplicate email', async () => {
    const payload = JSON.stringify({
      name: 'twice',
      email: `${TAG}-dup@test.local`,
      password: 'another-fine-password',
      roleId: weakRoleId,
    });
    expect((await call('admin/admin-users', { method: 'POST', body: payload }, owner.token)).status).toBe(201);
    expect((await call('admin/admin-users', { method: 'POST', body: payload }, owner.token)).status).toBe(409);
  });

  it('refuses a short password and an unknown role', async () => {
    const short = await call(
      'admin/admin-users',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'x', email: `${TAG}-short@test.local`, password: 'short', roleId: weakRoleId,
        }),
      },
      owner.token,
    );
    expect(short.status).toBe(400);

    const unknownRole = await call(
      'admin/admin-users',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'x',
          email: `${TAG}-norole@test.local`,
          password: 'another-fine-password',
          roleId: '00000000-0000-4000-8000-000000000000',
        }),
      },
      owner.token,
    );
    expect(unknownRole.status).toBe(400);
  });
});

describe('disabling an account', () => {
  it('stops that account signing in, and keeps its history', async () => {
    const leaver = await makeAdmin('leaver', weakRoleId);

    // They did something first — the audit trail must survive them.
    await prisma.activityLog.create({
      data: { actorId: leaver.id, action: 'update', entityType: 'bookings', entityId: 'b-1' },
    });

    const res = await call(
      `admin/admin-users/${leaver.id}`,
      { method: 'PATCH', body: JSON.stringify({ active: false }) },
      owner.token,
    );
    expect(res.status).toBe(200);

    const login = await call('admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: leaver.email, password: PASSWORD }),
    });
    expect(login.status).toBe(401);

    const history = await prisma.activityLog.findMany({ where: { actorId: leaver.id } });
    expect(history.length).toBeGreaterThan(0);
  });

  it('refuses to disable your own account', async () => {
    const res = await call(
      `admin/admin-users/${owner.id}`,
      { method: 'PATCH', body: JSON.stringify({ active: false }) },
      owner.token,
    );
    expect(res.status).toBe(403);

    // Still working.
    expect((await call('admin/admin-users', {}, owner.token)).status).toBe(200);
  });
});

describe('the lockout rules', () => {
  /*
   * The rule is about the whole database, not this suite's fixtures — "is there
   * anybody left who can manage accounts" has to count the seeded «مدير عام» too.
   * My first draft of these tests forgot that and asserted a 200 was a 403.
   *
   * So: park every other manager for the duration, and put them back afterwards.
   */
  let parked: string[] = [];

  beforeEach(async () => {
    const others = await prisma.adminUser.findMany({
      where: { active: true, id: { not: owner.id } },
    });
    parked = others.map((a) => a.id);
    await prisma.adminUser.updateMany({ where: { id: { in: parked } }, data: { active: false } });
  });

  afterEach(async () => {
    await prisma.adminUser.updateMany({ where: { id: { in: parked } }, data: { active: true } });
  });

  it('refuses to move the last manager to a role that cannot manage accounts', async () => {
    // Nobody could grant the permission back, and the only way in would be psql.
    const res = await call(
      `admin/admin-users/${owner.id}`,
      { method: 'PATCH', body: JSON.stringify({ roleId: weakRoleId }) },
      owner.token,
    );
    expect(res.status).toBe(403);
    expect(JSON.stringify(await body(res))).toContain('الوحيد');

    const unchanged = await prisma.adminUser.findUnique({ where: { id: owner.id } });
    expect(unchanged!.roleId).toBe(superRoleId);
  });

  it('allows the same change once someone else can manage accounts', async () => {
    const second = await makeAdmin('replacement-manager', superRoleId);
    expect(second.id).toBeTruthy();

    const res = await call(
      `admin/admin-users/${owner.id}`,
      { method: 'PATCH', body: JSON.stringify({ roleId: weakRoleId }) },
      owner.token,
    );
    expect(res.status).toBe(200);
  });
});

describe("resetting someone else's password", () => {
  it('sets the new password and revokes their sessions', async () => {
    const colleague = await makeAdmin('forgot', weakRoleId);

    const before = await call('admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: colleague.email, password: PASSWORD }),
    });
    const beforeBody = await body(before);
    expect(before.status).toBe(200);

    const res = await call(
      `admin/admin-users/${colleague.id}/reset-password`,
      { method: 'POST', body: JSON.stringify({ newPassword: 'a-brand-new-password' }) },
      owner.token,
    );
    expect(res.status).toBe(200);

    // Old password dead, new one works.
    const old = await call('admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: colleague.email, password: PASSWORD }),
    });
    expect(old.status).toBe(401);

    const now = await call('admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: colleague.email, password: 'a-brand-new-password' }),
    });
    expect(now.status).toBe(200);

    // The session opened with the old password is gone, not just the password.
    const refreshed = await call('auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: beforeBody.refreshToken }),
    });
    expect(refreshed.status).toBe(401);
  });
});

describe('authorization', () => {
  it('a guest cannot reach any of it', async () => {
    expect((await call('admin/admin-users')).status).toBe(401);
    expect(
      (await call('admin/admin-users', { method: 'POST', body: JSON.stringify({}) })).status,
    ).toBe(401);
  });

  it('an admin without roles:write is refused', async () => {
    const weak = await makeAdmin('weak', weakRoleId);

    expect((await call('admin/admin-users', {}, weak.token)).status).toBe(403);
    expect(
      (
        await call(
          `admin/admin-users/${owner.id}`,
          { method: 'PATCH', body: JSON.stringify({ name: 'renamed by someone unauthorised' }) },
          weak.token,
        )
      ).status,
    ).toBe(403);

    const unchanged = await prisma.adminUser.findUnique({ where: { id: owner.id } });
    expect(unchanged!.name).not.toContain('unauthorised');
  });
});

describe('the audit trail', () => {
  it('records the change without ever storing the password', async () => {
    const res = await call(
      'admin/admin-users',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'audited',
          email: `${TAG}-audited@test.local`,
          password: 'a-secret-that-must-not-be-logged',
          roleId: weakRoleId,
        }),
      },
      owner.token,
    );
    expect(res.status).toBe(201);
    const created = await body(res);

    const entries = await prisma.activityLog.findMany({
      where: { actorId: owner.id, entityType: 'admin-users' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe(created.id);

    /*
     * The reason this controller does not carry ActivityLogInterceptor: it
     * stores `newValue: request.body`, and this body has a password in it.
     */
    expect(JSON.stringify(entries[0])).not.toContain('a-secret-that-must-not-be-logged');
  });
});
