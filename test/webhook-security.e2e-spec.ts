import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createHmac } from 'crypto';

import { DonationsWebhookController } from '../src/donations/donations-webhook.controller';
import { DonationsService } from '../src/donations/donations.service';
import { validateEnv } from '../src/config/app.config';

/**
 * `POST /webhooks/payment` can mark a donation paid, so it has to fail CLOSED.
 *
 * It originally verified the HMAC only `if (secret)`, so an unset secret skipped
 * the check entirely and left the route public while appearing protected. It also
 * had no body validation, so a malformed payload raised a 500 from inside
 * handleWebhook. (The deployed environment does have a secret configured — an
 * unsigned probe against production returns 401 — but the code must not depend
 * on that remaining true.)
 *
 * The interesting behaviour is what happens when the secret is MISSING, so the
 * suite covers every combination of NODE_ENV and the ALLOW_UNSIGNED_WEBHOOKS
 * escape hatch, plus the boot-time guard that should stop production earlier.
 */

const handled: unknown[] = [];
const SECRET = 'test-webhook-secret';

function buildModule(env: Record<string, string | boolean | undefined>) {
  @Module({
    controllers: [DonationsWebhookController],
    providers: [
      {
        provide: DonationsService,
        useValue: { handleWebhook: async (...args: unknown[]) => (handled.push(args), { ok: true }) },
      },
      { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
    ],
  })
  class WebhookModule {}
  return WebhookModule;
}

const sign = (body: unknown, secret = SECRET) =>
  createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

const VALID = { gatewayTxId: 'tx-1', amount: 100, status: 'paid' };

async function start(env: Record<string, string | boolean | undefined>) {
  const app = await NestFactory.create(buildModule(env), { logger: false });
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  return { app, base };
}

const post = (base: string, body: unknown, signature?: string) =>
  fetch(`${base}/webhooks/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'x-webhook-signature': signature } : {}),
    },
    body: JSON.stringify(body),
  });

describe('payment webhook', () => {
  beforeEach(() => {
    handled.length = 0;
  });

  describe('with WEBHOOK_SECRET configured', () => {
    let app: INestApplication;
    let base: string;

    beforeAll(async () => {
      ({ app, base } = await start({ WEBHOOK_SECRET: SECRET, NODE_ENV: 'production' }));
    });
    afterAll(async () => {
      await app?.close();
    });

    it('accepts a correctly signed payload', async () => {
      const res = await post(base, VALID, sign(VALID));
      expect(res.status).toBeLessThan(300);
      expect(handled).toHaveLength(1);
    });

    it('rejects a missing signature', async () => {
      expect((await post(base, VALID)).status).toBe(401);
      expect(handled).toHaveLength(0);
    });

    it('rejects a wrong signature', async () => {
      expect((await post(base, VALID, sign(VALID, 'other-secret'))).status).toBe(401);
      expect(handled).toHaveLength(0);
    });

    it('rejects a signature of a different body — replaying one payload onto another', async () => {
      const res = await post(base, { ...VALID, amount: 999999 }, sign(VALID));
      expect(res.status).toBe(401);
      expect(handled).toHaveLength(0);
    });

    it('rejects a truncated signature rather than throwing on length mismatch', async () => {
      expect((await post(base, VALID, sign(VALID).slice(0, 10))).status).toBe(401);
    });

    it('rejects a malformed body with 400, not 500', async () => {
      const res = await post(base, { amount: 'not-a-number' }, sign({ amount: 'not-a-number' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION');
      expect(Object.keys(body.error.fields)).toContain('gatewayTxId');
      expect(handled).toHaveLength(0);
    });
  });

  describe('with WEBHOOK_SECRET missing', () => {
    it('refuses to process the webhook in production', async () => {
      const { app, base } = await start({ NODE_ENV: 'production' });
      try {
        // 503, not 200: an unconfigured secret must never mean "skip the check".
        expect((await post(base, VALID, sign(VALID))).status).toBe(503);
        expect(handled).toHaveLength(0);
      } finally {
        await app.close();
      }
    });

    it('refuses when NODE_ENV is unset — the fail-open case this guard exists for', async () => {
      // NODE_ENV defaults to 'development' when absent, so the old
      // `NODE_ENV !== 'production'` bypass turned a forgotten env var into a
      // fully public endpoint that can mark donations paid.
      const { app, base } = await start({});
      try {
        expect((await post(base, VALID, sign(VALID))).status).toBe(503);
        expect(handled).toHaveLength(0);
      } finally {
        await app.close();
      }
    });

    it('refuses in development too, unless the bypass is explicitly opted into', async () => {
      const { app, base } = await start({ NODE_ENV: 'development' });
      try {
        expect((await post(base, VALID)).status).toBe(503);
        expect(handled).toHaveLength(0);
      } finally {
        await app.close();
      }
    });

    it('allows it with ALLOW_UNSIGNED_WEBHOOKS=true, so local work needs no secret', async () => {
      const { app, base } = await start({ NODE_ENV: 'development', ALLOW_UNSIGNED_WEBHOOKS: true });
      try {
        expect((await post(base, VALID)).status).toBeLessThan(300);
        expect(handled).toHaveLength(1);
      } finally {
        await app.close();
      }
    });

    it('ignores ALLOW_UNSIGNED_WEBHOOKS in production — the escape hatch is not reachable there', async () => {
      const { app, base } = await start({ NODE_ENV: 'production', ALLOW_UNSIGNED_WEBHOOKS: true });
      try {
        expect((await post(base, VALID, sign(VALID))).status).toBe(503);
        expect(handled).toHaveLength(0);
      } finally {
        await app.close();
      }
    });
  });
});

/**
 * Boot-time guard: the controller's 503 is the last line of defence, but an
 * operator should learn about a missing secret at deploy time, not when real
 * payment callbacks start failing.
 */
describe('env validation', () => {
  const BASE = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'access-secret-long-enough',
    JWT_REFRESH_SECRET: 'refresh-secret-long-enough',
  };

  it('refuses to boot in production without WEBHOOK_SECRET', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('refuses a placeholder secret that is too short to be meaningful', () => {
    expect(() =>
      validateEnv({ ...BASE, NODE_ENV: 'production', WEBHOOK_SECRET: 'short' }),
    ).toThrow('Invalid environment configuration');
  });

  it('boots in production with a real secret', () => {
    const env = validateEnv({
      ...BASE,
      NODE_ENV: 'production',
      WEBHOOK_SECRET: 'a-sufficiently-long-webhook-secret',
    });
    expect(env.WEBHOOK_SECRET).toBe('a-sufficiently-long-webhook-secret');
  });

  it('still boots in development without one, so local setup is unchanged', () => {
    expect(() => validateEnv({ ...BASE })).not.toThrow();
  });
});
