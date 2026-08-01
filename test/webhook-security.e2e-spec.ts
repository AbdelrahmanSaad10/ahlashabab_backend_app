import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createHmac } from 'crypto';

import { DonationsWebhookController } from '../src/donations/donations-webhook.controller';
import { DonationsService } from '../src/donations/donations.service';

/**
 * `POST /webhooks/payment` can mark a donation paid, so it has to fail CLOSED.
 *
 * It previously verified the HMAC only `if (secret)` — and WEBHOOK_SECRET was not
 * set in the deployed environment, so the check was skipped entirely and the
 * route was effectively public while appearing protected. It also had no body
 * validation, so a malformed payload raised a 500 from inside handleWebhook.
 *
 * Run twice: once with a secret configured, once without, since the interesting
 * behaviour is what happens when it is missing.
 */

const handled: unknown[] = [];
const SECRET = 'test-webhook-secret';

function buildModule(env: Record<string, string | undefined>) {
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

async function start(env: Record<string, string | undefined>) {
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

    it('allows it outside production, so local work needs no secret', async () => {
      const { app, base } = await start({ NODE_ENV: 'development' });
      try {
        expect((await post(base, VALID)).status).toBeLessThan(300);
        expect(handled).toHaveLength(1);
      } finally {
        await app.close();
      }
    });
  });
});
