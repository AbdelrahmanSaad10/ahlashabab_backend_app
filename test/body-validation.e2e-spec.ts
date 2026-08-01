import 'reflect-metadata';
import { CanActivate, ExecutionContext, INestApplication, Injectable, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';

import { BookingsController } from '../src/bookings/bookings.controller';
import { BookingsService } from '../src/bookings/bookings.service';
import { DonationsController } from '../src/donations/donations.controller';
import { DonationsService } from '../src/donations/donations.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

/**
 * Regression test for where the Zod pipe is attached.
 *
 * A method-level `@UsePipes(new ZodValidationPipe(Schema))` applies to EVERY
 * handler parameter, not just the body. On the three handlers that take a second
 * parameter it therefore also ran against `@CurrentUser()` — `null`/`undefined`
 * for a guest under `@OptionalAuth`, and the user entity when a token is present.
 * Both fail the body schema, so `POST /donations`, `POST /bookings` and
 * `PATCH /me` rejected *every* request with
 * `{"": "Expected object, received null"}` — the two main public write paths were
 * dead for authenticated and anonymous callers alike.
 *
 * The fix is to attach the pipe to the body parameter. This asserts a valid body
 * reaches the service, and that an invalid one is still rejected per field — so a
 * future refactor cannot "fix" this by removing validation.
 *
 * No guards and no database: the controllers are wired to stub services, which is
 * enough to reproduce the parameter-pipe behaviour.
 */

const created: Record<string, unknown>[] = [];

/**
 * Stands in for JwtAuthGuard. PATCH /me is an authenticated route and its handler
 * reads `user.sub` directly, so a user has to be present. It also keeps the test
 * honest: with the pipe applied to the whole handler, this object is exactly what
 * used to be validated against the body schema, and fail.
 */
@Injectable()
class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Only the /me routes are authenticated; the public write paths stay anonymous.
    if (String(req.url).startsWith('/me')) req.user = { id: 'u1', sub: 'u1' };
    return true;
  }
}

@Module({
  controllers: [BookingsController, DonationsController, UsersController],
  providers: [
    {
      provide: BookingsService,
      useValue: {
        create: async (dto: any) => (created.push(dto), { id: 'b1', ...dto }),
        getAvailability: async () => [],
        findByReference: async () => null,
      },
    },
    {
      provide: DonationsService,
      useValue: {
        create: async (dto: any) => (created.push(dto), { id: 'd1', ...dto }),
        findByReference: async () => null,
      },
    },
    {
      provide: UsersService,
      useValue: {
        findById: async () => ({ id: 'u1' }),
        updateProfile: async (_id: string, dto: any) => (created.push(dto), { id: 'u1', ...dto }),
        getUserBookings: async () => [],
        getUserDonations: async () => [],
        getUserConsultations: async () => [],
        getFavorites: async () => [],
        addFavorite: async () => ({}),
        removeFavorite: async () => ({}),
        registerDeviceToken: async () => ({}),
      },
    },
    { provide: APP_GUARD, useClass: StubAuthGuard },
  ],
})
class BodyProbeModule {}

describe('Zod pipe is attached to the body, not the whole handler', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(BodyProbeModule, { logger: false });
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (path: string, body: unknown) =>
    fetch(`${base}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const patch = (path: string, body: unknown) =>
    fetch(`${base}/${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    created.length = 0;
  });

  describe('POST /donations (OptionalAuth, so @CurrentUser is empty)', () => {
    const valid = { donorName: 'اختبار', cause: 'دعم عام', amount: 100, method: 'إنستاباي' };

    it('accepts a valid body and passes it to the service', async () => {
      const res = await post('donations', valid);
      expect(res.status).toBeLessThan(300);
      expect(created[0]).toMatchObject(valid);
    });

    it('still rejects an invalid body, per field', async () => {
      const res = await post('donations', { donorName: 'x', amount: -5 });
      expect(res.status).toBe(400);
      const body = await res.json();
      // The failure must be on real fields, never the root — a root-level
      // "Expected object, received null" is the bug this guards against.
      expect(Object.keys(body.error.fields)).toContain('cause');
      expect(Object.keys(body.error.fields)).not.toContain('');
      expect(created).toHaveLength(0);
    });
  });

  describe('POST /bookings (OptionalAuth)', () => {
    const valid = {
      serviceId: 'svc-6',
      applicantName: 'اختبار',
      phone: '01000000000',
      date: '2026-08-05',
      timeSlot: '10:00',
    };

    it('accepts a valid body, including a non-uuid serviceId', async () => {
      const res = await post('bookings', valid);
      expect(res.status).toBeLessThan(300);
      expect(created[0]).toMatchObject(valid);
    });

    it('still rejects a missing serviceId', async () => {
      const res = await post('bookings', { ...valid, serviceId: '' });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error.fields.serviceId).toBeTruthy();
      expect(Object.keys(body.error.fields)).not.toContain('');
    });
  });

  describe('PATCH /me (@CurrentUser comes first in the signature)', () => {
    it('accepts a valid body', async () => {
      const res = await patch('me', { name: 'اسم جديد' });
      expect(res.status).toBeLessThan(300);
      expect(created[0]).toMatchObject({ name: 'اسم جديد' });
    });
  });
});
