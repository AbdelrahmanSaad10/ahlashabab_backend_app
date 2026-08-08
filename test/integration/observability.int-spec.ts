import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Public } from '../../src/common/decorators/public.decorator';
import { integrationDb } from './db';

/**
 * Monitoring — row 46, the parts that do not depend on choosing a vendor.
 *
 * `GET /health` returned `{ message: 'ok' }` unconditionally: it checked nothing.
 * An uptime monitor pointed at it reported the platform healthy while PostgreSQL
 * was down and every request was failing. A monitor that cannot go red turns an
 * outage into silence, and it is the first thing anyone wires an alert to.
 *
 * And when a 500 did happen, the log said `Unhandled exception:` and a stack —
 * no method, no path, no request id, no actor — in a pm2 log shared with three
 * other applications. There was no way to connect a report to the failure.
 */

const prisma = integrationDb();

let app: INestApplication;
let base: string;

/** A route that throws something the filters do not recognise. */
@Controller('__test')
class BoomController {
  @Public()
  @Get('boom')
  boom() {
    throw new Error('deliberate failure for the observability suite');
  }
}

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

const call = (path: string, init: RequestInit = {}) => fetch(`${base}/api/v1/${path}`, init);

describe('the health check answers for its dependencies', () => {
  it('reports ok with the database reachable', async () => {
    const res = await call('health');
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('up');
    expect(typeof body.checks.database.latencyMs).toBe('number');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('keeps the original `message: ok`, so anything already checking it still works', async () => {
    const body: any = await (await call('health')).json();
    expect(body.message).toBe('ok');
  });

  it('answers 503 when the database cannot be reached', async () => {
    /*
     * The property the whole endpoint exists for. Before this, the response was
     * a hardcoded object and this test could not have failed — which is exactly
     * why an outage would have gone unreported.
     */
    const service = app.get(PrismaService);
    const original = service.$queryRawUnsafe.bind(service);
    (service as any).$queryRawUnsafe = () => Promise.reject(new Error('connection refused'));

    try {
      const res = await call('health');
      expect(res.status).toBe(503);

      const body: any = await res.json();
      expect(body.status).toBe('down');
      expect(body.checks.database.status).toBe('down');
    } finally {
      (service as any).$queryRawUnsafe = original;
    }
  });

  it('never puts the datasource URL in the response — it is a public endpoint', async () => {
    // A Prisma connection error carries the connection string, which includes the
    // host, user and password. Reporting the raw message would publish them to
    // anyone who curls this during an outage.
    const service = app.get(PrismaService);
    const original = service.$queryRawUnsafe.bind(service);
    (service as any).$queryRawUnsafe = () =>
      Promise.reject(new Error("Can't reach database server at postgres://user:s3cret@db-host:5432"));

    try {
      const text = await (await call('health')).text();
      expect(text).not.toContain('s3cret');
      expect(text).not.toContain('db-host');
      expect(text).not.toContain('postgres://');
      expect(JSON.parse(text).checks.database.reason).toBe('unreachable');
    } finally {
      (service as any).$queryRawUnsafe = original;
    }
  });
});

describe('every request is identifiable', () => {
  it('returns an X-Request-Id', async () => {
    const res = await call('health');
    expect(res.headers.get('x-request-id')).toMatch(/[0-9a-f-]{16,}/i);
  });

  it('gives different requests different ids', async () => {
    const a = (await call('health')).headers.get('x-request-id');
    const b = (await call('health')).headers.get('x-request-id');
    expect(a).not.toBe(b);
  });

  it('honours an inbound id, so a trace survives the proxy', async () => {
    const res = await call('health', { headers: { 'X-Request-Id': 'trace-from-nginx-123' } });
    expect(res.headers.get('x-request-id')).toBe('trace-from-nginx-123');
  });

  it('ignores an absurdly long inbound id rather than logging it', async () => {
    // The value lands in log lines; unbounded, it is a log-flooding lever.
    const res = await call('health', { headers: { 'X-Request-Id': 'x'.repeat(5000) } });
    const id = res.headers.get('x-request-id');
    expect(id).not.toContain('xxxxxxxxxx');
    expect(id!.length).toBeLessThan(64);
  });
});

describe('a 500 can be traced back', () => {
  let boomApp: INestApplication;
  let boomBase: string;

  beforeAll(async () => {
    // The failing route is registered in its own app so the main one stays clean.
    const { Module } = await import('@nestjs/common');
    @Module({ imports: [AppModule], controllers: [BoomController] })
    class BoomModule {}

    boomApp = await NestFactory.create(BoomModule, { logger: false });
    boomApp.setGlobalPrefix('api/v1');
    await boomApp.listen(0);
    boomBase = (await boomApp.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await boomApp?.close();
  });

  it('returns the request id in the error body, for the user to quote', async () => {
    const res = await fetch(`${boomBase}/api/v1/__test/boom`);
    expect(res.status).toBe(500);

    const body: any = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.message).toBe('خطأ داخلي في الخادم');
    // Without this, «خطأ داخلي» is the entire evidence trail.
    expect(body.error.requestId).toBe(res.headers.get('x-request-id'));
  });

  it('still leaks nothing about the failure itself', async () => {
    const text = await (await fetch(`${boomBase}/api/v1/__test/boom`)).text();
    expect(text).not.toContain('deliberate failure');
    expect(text).not.toContain('Error');
    expect(text).not.toContain('at ');
  });
});
