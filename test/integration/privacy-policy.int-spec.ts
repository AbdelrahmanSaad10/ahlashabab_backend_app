import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { integrationDb } from './db';

/**
 * The privacy policy page — T-06's successor, and a Play submission requirement.
 *
 * Google Play will not accept an app that collects personal data without a
 * publicly reachable privacy policy URL. This app collects optional national ID
 * numbers and people's written accounts of their own circumstances, and had a
 * menu entry pointing at a CMS page that was not in the CMS document.
 *
 * The tests worth having are not "does it render" but: can a signed-out stranger
 * read it, does it actually name the sensitive things, and are the foundation's
 * unmade decisions still visibly unmade.
 */

const prisma = integrationDb();
let app: INestApplication;
let base: string;

beforeAll(async () => {
  await prisma.$connect();
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const get = () => fetch(`${base}/api/v1/privacy`);

describe('the policy is publicly readable', () => {
  it('answers 200 to a request with no token at all', async () => {
    // Play's crawler is anonymous. A policy behind auth is not a policy.
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('is a complete HTML document, not a fragment', async () => {
    const html = await (await get()).text();
    expect(html.trimStart().startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('is in Arabic first, with English available', async () => {
    const html = await (await get()).text();
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('سياسة الخصوصية');
    expect(html).toContain('Privacy Policy');
  });
});

describe('it discloses what is actually collected', () => {
  /*
   * Each of these is a real column in schema.prisma. A policy that omits one is
   * not merely incomplete — for the national ID and the free-text summary it is
   * the difference between disclosure and concealment.
   */
  it.each([
    ['the national ID', 'الرقم القومي'],
    ['the written description of circumstances', 'وصفك المكتوب بنفسك'],
    ['WhatsApp', 'واتساب'],
    ['device notification tokens', 'رمز الجهاز'],
    ['the admin IP log', 'عنوان الشبكة'],
  ])('names %s', async (_label, needle) => {
    expect(await (await get()).text()).toContain(needle);
  });

  it('states that the national ID is optional', async () => {
    const html = await (await get()).text();
    expect(html).toMatch(/اختياري/);
    expect(html).toContain('optional');
  });

  it('states plainly that no card details are held', async () => {
    // True, and worth saying: there is no payment gateway at all.
    const html = await (await get()).text();
    expect(html).toContain('لا نجمع أي بيانات بطاقات بنكية');
    expect(html).toContain('never collect card details');
  });

  it('offers a route to deletion, which Play also requires', async () => {
    const html = await (await get()).text();
    expect(html).toContain('حذف حسابك');
    expect(html).toContain('delete your account');
  });
});

describe('the foundation’s unmade decisions stay visible', () => {
  it('still carries its placeholders', async () => {
    /*
     * This test is meant to FAIL the day the policy is finished — and that is
     * the point. Until the foundation supplies its registered name, contact
     * address and retention periods, the page must not read as though it has
     * them. Filling those with plausible defaults would make the policy a
     * statement the foundation never agreed to.
     */
    const html = await (await get()).text();
    expect(html).toContain('[[');
    expect(html).toMatch(/بريد التواصل|contact email/);
  });
});
