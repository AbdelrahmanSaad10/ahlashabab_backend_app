import 'reflect-metadata';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';

import { JwtAccessStrategy } from '../src/auth/strategies/jwt-access.strategy';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { RequirePermission } from '../src/common/decorators/permissions.decorator';
import { CurrentAdmin } from '../src/common/decorators/current-admin.decorator';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Regression test for the request.user / request.adminUser wiring.
 *
 * `JwtAccessStrategy` resolves to `{ adminUser }` or `{ user }`, and Passport
 * assigns that to `request.user`. `RolesGuard`, `CurrentAdmin` and
 * `ActivityLogInterceptor` all read `request.adminUser` instead, and the /me
 * controllers read `.sub`/`.id`. Unless `JwtAuthGuard.handleRequest` unwraps the
 * result, every @RequirePermission route answers 403 regardless of role, and
 * every /me route runs against an undefined user id.
 *
 * This reproduces the real guard chain (global order: JwtAuthGuard -> RolesGuard)
 * with Prisma stubbed, so it needs no database and no credentials. It covers the
 * allow paths *and* the deny paths — a fix that let everyone through would make
 * the first case pass and the rest fail.
 */

const SECRET = 'test-only-secret';

const ADMIN = {
  id: 'admin-1',
  email: 'admin@example.com',
  active: true,
  role: { permissionsJson: { users: { read: true, write: true } } },
};
const ADMIN_NO_PERM = {
  ...ADMIN,
  id: 'admin-noperm',
  role: { permissionsJson: { donations: { read: true } } },
};
const USER = { id: 'user-1', email: 'user@example.com', blocked: false };

@Controller()
class ProbeController {
  @Get('admin-route')
  @RequirePermission('users', 'read')
  admin(@CurrentAdmin() adminUser: any) {
    return { adminUser: adminUser ?? null };
  }

  @Get('me-route')
  me(@CurrentUser() user: any) {
    return { sub: user?.sub ?? null, id: user?.id ?? null };
  }
}

@Module({
  imports: [PassportModule],
  controllers: [ProbeController],
  providers: [
    JwtAccessStrategy,
    { provide: ConfigService, useValue: { get: () => SECRET } },
    {
      provide: PrismaService,
      useValue: {
        adminUser: {
          findUnique: async ({ where }: any) =>
            where.id === ADMIN_NO_PERM.id ? ADMIN_NO_PERM : ADMIN,
        },
        user: { findUnique: async () => USER },
      },
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
class ProbeModule {}

const token = (type: 'admin' | 'user', sub: string) =>
  jwt.sign({ sub, email: 'x@example.com', type }, SECRET, { expiresIn: '5m' });

describe('authenticated request shape', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { logger: false });
    await app.listen(0);
    // getUrl() reports the IPv6 loopback on some hosts; fetch is happier with v4.
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (path: string, tok?: string) =>
    fetch(`${base}/${path}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });

  describe('admin routes behind @RequirePermission', () => {
    it('admits an admin whose role grants the permission', async () => {
      const res = await get('admin-route', token('admin', ADMIN.id));
      expect(res.status).toBe(200);
      // Proves request.adminUser was populated — CurrentAdmin reads it, and so
      // does ActivityLogInterceptor, which silently skips logging without it.
      const body = await res.json();
      expect(body.data?.adminUser?.id ?? body.adminUser?.id).toBe(ADMIN.id);
    });

    it('rejects an admin whose role lacks the permission', async () => {
      const res = await get('admin-route', token('admin', ADMIN_NO_PERM.id));
      expect(res.status).toBe(403);
    });

    it('rejects a user-type token', async () => {
      const res = await get('admin-route', token('user', USER.id));
      expect(res.status).toBe(403);
    });

    it('rejects an anonymous request', async () => {
      expect((await get('admin-route')).status).toBe(401);
    });
  });

  describe('/me routes', () => {
    it('resolves the user id under both id and sub', async () => {
      const res = await get('me-route', token('user', USER.id));
      expect(res.status).toBe(200);
      const body = await res.json();
      const payload = body.data ?? body;
      // Both spellings are in use across the /me controllers; a null here means
      // those routes are querying with an undefined id.
      expect(payload.id).toBe(USER.id);
      expect(payload.sub).toBe(USER.id);
    });

    it('rejects an anonymous request', async () => {
      expect((await get('me-route')).status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      expect((await get('me-route', 'not-a-jwt')).status).toBe(401);
    });
  });
});
