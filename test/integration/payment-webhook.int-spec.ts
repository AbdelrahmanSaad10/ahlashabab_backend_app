import 'reflect-metadata';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { integrationDb } from './db';
import { DonationsService } from '../../src/donations/donations.service';
import { generateReference } from '../../src/common/utils/reference.util';

/**
 * T-10 — the payment confirmation path, against a real database.
 *
 * **A gateway sandbox is deliberately NOT integrated.** The client's instruction
 * is explicit: *"There is currently NO online payment gateway and the app must
 * NOT simulate instant payment success."* All three approved methods — تحويل
 * بنكي، فوري، فودافون كاش — are completed outside the app and approved by an
 * admin. Wiring a sandbox would build the very thing the client ruled out.
 *
 * What *is* real and testable is `handleWebhook`, which exists and would run the
 * moment any gateway were ever connected. These tests pin its behaviour — and
 * document a defect that must be fixed BEFORE that day, not after.
 */

const prisma = integrationDb();
const donations = new DonationsService(prisma as any, new EventEmitter2());

const TAG = 'INT-WEBHOOK';

const mkPending = async (amount: number, name: string) =>
  prisma.donation.create({
    data: {
      reference: generateReference('AS'),
      donorName: `${TAG}-${name}`,
      cause: 'دعم عام',
      amount,
      method: 'تحويل بنكي',
      // The webhook only ever matches this status.
      status: 'قيد التأكيد',
    },
  });

const clean = () => prisma.donation.deleteMany({ where: { donorName: { startsWith: TAG } } });

beforeAll(async () => {
  await prisma.$connect();
  await clean();
});
afterEach(clean);
afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe('a confirmed payment is applied once', () => {
  it('moves a pending donation to «مكتمل» and records the gateway id', async () => {
    const d = await mkPending(100, 'a');
    const out: any = await donations.handleWebhook('tx-success-1', 100, 'success');
    expect(out.id).toBe(d.id);
    expect(out.status).toBe('مكتمل');
    expect(out.gatewayTxId).toBe('tx-success-1');
  });

  it('is idempotent — a redelivered webhook does not double-apply', async () => {
    // Gateways retry. If the second delivery matched a *different* pending
    // donation, one payment would confirm two donations.
    await mkPending(250, 'b1');
    await mkPending(250, 'b2');

    const first: any = await donations.handleWebhook('tx-dupe', 250, 'success');
    const second: any = await donations.handleWebhook('tx-dupe', 250, 'success');

    expect(second.id).toBe(first.id);

    const completed = await prisma.donation.count({
      where: { donorName: { startsWith: TAG }, status: 'مكتمل' },
    });
    expect(completed).toBe(1);
  });

  it('marks a failed callback «فشل» rather than completing it', async () => {
    await mkPending(300, 'c');
    const out: any = await donations.handleWebhook('tx-failed', 300, 'failed');
    expect(out.status).toBe('فشل');
  });

  it('never regresses a completed donation — a late "failed" cannot undo it', async () => {
    const d = await mkPending(400, 'd');
    await donations.handleWebhook('tx-final-1', 400, 'success');

    // A late "failed" arriving under a different gateway id, with the link
    // cleared as a redelivery or a provider replay might leave it.
    await prisma.donation.update({ where: { id: d.id }, data: { gatewayTxId: null } });
    await expect(donations.handleWebhook('tx-final-2', 400, 'failed')).rejects.toThrow();

    const after = await prisma.donation.findUnique({ where: { id: d.id } });
    expect(after!.status).toBe('مكتمل');
  });

  it('the FINAL_STATES guard is unreachable — the query already excludes final rows', async () => {
    /*
     * `handleWebhook` carries a "never regress from a final state" check, but the
     * lookup preceding it filters on `status: PENDING_CONFIRMATION`, so a
     * completed or failed donation can never be selected in the first place.
     * The protection is real; the code implementing it is dead. Worth knowing
     * before someone "fixes" the query and unknowingly relies on that branch.
     */
    const d = await mkPending(450, 'e');
    await donations.handleWebhook('tx-guard', 450, 'success');
    await expect(donations.handleWebhook('tx-guard-2', 450, 'success')).rejects.toThrow();
    const after = await prisma.donation.findUnique({ where: { id: d.id } });
    expect(after!.status).toBe('مكتمل');
  });

  it('rejects a callback with no matching pending donation', async () => {
    await expect(donations.handleWebhook('tx-orphan', 999_999, 'success')).rejects.toThrow();
  });
});

describe('⚠️ the matching rule is by AMOUNT — a defect for the day a gateway exists', () => {
  /*
   * `handleWebhook` selects its donation with:
   *
   *     findMany({ where: { status: PENDING_CONFIRMATION, amount, gatewayTxId: null },
   *                orderBy: { createdAt: 'asc' }, take: 1 })
   *
   * There is no donation reference in the lookup. Two donors giving the same
   * amount are indistinguishable, so a callback for one confirms whichever was
   * created FIRST. The money is real; the receipt would be attached to the wrong
   * person.
   *
   * This is latent today — see the suite below, nothing reaches this status any
   * more — but it must be fixed before any gateway is connected. The fix is to
   * carry the donation `reference` through the payment and match on it.
   */
  it('confirms the OLDEST same-amount donation, not necessarily the payer’s', async () => {
    const older = await mkPending(500, 'older');
    const newer = await mkPending(500, 'newer');

    const out: any = await donations.handleWebhook('tx-ambiguous', 500, 'success');

    // Documents the current behaviour rather than endorsing it.
    expect(out.id).toBe(older.id);
    expect(out.id).not.toBe(newer.id);

    const stillPending = await prisma.donation.findUnique({ where: { id: newer.id } });
    expect(stillPending!.status).toBe('قيد التأكيد');
  });
});

describe('with no gateway, nothing can reach the webhook path at all', () => {
  it('every approved method is created «قيد المراجعة», which the webhook never matches', async () => {
    for (const method of ['تحويل بنكي', 'فوري', 'فودافون كاش']) {
      const created: any = await donations.create({
        donorName: `${TAG}-${method}`, cause: 'دعم عام', amount: 75, method,
      } as any);
      expect(created.status).toBe('قيد المراجعة');
    }

    // The webhook only ever looks for «قيد التأكيد», so a callback finds nothing.
    await expect(donations.handleWebhook('tx-none', 75, 'success')).rejects.toThrow();
  });
});

/**
 * The same path over real HTTP, with a genuine HMAC signature.
 *
 * `webhook-security.e2e-spec.ts` already proves the signature check rejects
 * bad input, but it stubs the service. This closes the loop: a correctly signed
 * callback must actually move a donation in the database.
 */
describe('signed webhook over HTTP, end to end', () => {
  const { createHmac } = require('crypto');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../../src/app.module');

  let app: any;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });
  afterAll(async () => { await app?.close(); });

  const post = (body: unknown, signature?: string) =>
    fetch(`${base}/api/v1/webhooks/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'x-webhook-signature': signature } : {}),
      },
      body: JSON.stringify(body),
    });

  const sign = (body: unknown) =>
    createHmac('sha256', process.env.WEBHOOK_SECRET as string)
      .update(JSON.stringify(body))
      .digest('hex');

  it('a correctly signed callback moves the donation to «مكتمل»', async () => {
    const d = await mkPending(1234, 'http-ok');
    const body = { gatewayTxId: 'tx-http-1', amount: 1234, status: 'success' };

    const res = await post(body, sign(body));
    expect(res.status).toBeLessThan(300);

    const after = await prisma.donation.findUnique({ where: { id: d.id } });
    expect(after!.status).toBe('مكتمل');
    expect(after!.gatewayTxId).toBe('tx-http-1');
  });

  it('an unsigned callback changes nothing', async () => {
    const d = await mkPending(4321, 'http-unsigned');
    const res = await post({ gatewayTxId: 'tx-http-2', amount: 4321, status: 'success' });
    expect(res.status).toBe(401);

    const after = await prisma.donation.findUnique({ where: { id: d.id } });
    expect(after!.status).toBe('قيد التأكيد');
  });

  it('a tampered amount is rejected — the signature covers the body', async () => {
    const d = await mkPending(777, 'http-tampered');
    const original = { gatewayTxId: 'tx-http-3', amount: 777, status: 'success' };
    const tampered = { ...original, amount: 7_770_000 };

    const res = await post(tampered, sign(original));
    expect(res.status).toBe(401);

    const after = await prisma.donation.findUnique({ where: { id: d.id } });
    expect(after!.status).toBe('قيد التأكيد');
  });
});
