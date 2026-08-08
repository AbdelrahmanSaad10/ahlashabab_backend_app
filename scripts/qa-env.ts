/* eslint-disable @typescript-eslint/no-var-requires */
import 'reflect-metadata';
import { spawnSync } from 'child_process';
import { randomBytes } from 'crypto';
import { mkdtempSync } from 'fs';
import { createServer, Server, Socket } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { assertDisposable, freePort, startDisposablePostgres } from './disposable-postgres';

/**
 * A throwaway QA environment — T-06.
 *
 * T-06 asked for "a staging environment with seeded data and issued tokens that
 * QA can hit without touching production". Every part of that except a hosted
 * URL can be produced on demand, and this script does it in one command:
 *
 *   npm run qa:env          # bring it up and leave it running
 *   npm run qa:env -- --smoke   # bring it up, prove it, tear it down
 *
 * It provisions its own PostgreSQL, applies the real migrations, runs the real
 * seed, boots the real `AppModule`, and then obtains its tokens **through the
 * shipped login endpoints** — the admin password flow and the full email-OTP
 * exchange. Nothing is hand-signed. If a login route regresses, this fails.
 *
 * Two things it deliberately does NOT do:
 *
 *   - touch any existing database. It creates its own cluster in a temp dir and
 *     deletes it on exit; the name check below is a second line of defence for
 *     the case where an operator supplies `DATABASE_URL` themselves.
 *   - depend on Docker or on real SMTP credentials. The mail catcher below is a
 *     ~60-line SMTP sink, which is how the OTP code gets read back. That is what
 *     makes "login is blocked on SMTP" false for QA: only *production delivery*
 *     needs a mail provider.
 */

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const log = (msg: string) => console.log(msg);
const secret = (bytes = 24) => randomBytes(bytes).toString('base64url');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// A minimal SMTP sink, so the real OTP flow can run with no mail provider
// ---------------------------------------------------------------------------

interface MailSink {
  server: Server;
  /** Waits for a message addressed to `to` and returns the 6-digit code in it. */
  waitForCode: (to: string, timeoutMs?: number) => Promise<string>;
}

/** Undo quoted-printable, which is how nodemailer encodes the HTML body. */
function decodeQuotedPrintable(body: string): string {
  return body
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function startMailSink(port: number): Promise<MailSink> {
  const received: { to: string; body: string }[] = [];

  const server = createServer((socket: Socket) => {
    let inData = false;
    let data = '';
    let rcpt = '';

    socket.write('220 ahla-qa-sink ESMTP\r\n');
    socket.on('data', (chunk) => {
      for (const raw of chunk.toString('utf8').split(/\r?\n/)) {
        if (inData) {
          if (raw === '.') {
            inData = false;
            received.push({ to: rcpt, body: decodeQuotedPrintable(data) });
            data = '';
            socket.write('250 OK\r\n');
          } else {
            data += raw + '\n';
          }
          continue;
        }
        const line = raw.trim();
        if (!line) continue;
        const verb = line.split(/\s+/)[0].toUpperCase();
        if (verb === 'EHLO' || verb === 'HELO') socket.write('250 ahla-qa-sink\r\n');
        else if (verb === 'MAIL') socket.write('250 OK\r\n');
        else if (verb === 'RCPT') {
          rcpt = (line.match(/<([^>]+)>/) ?? [, ''])[1] as string;
          socket.write('250 OK\r\n');
        } else if (verb === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (verb === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else if (verb === 'RSET' || verb === 'NOOP') socket.write('250 OK\r\n');
        else socket.write('502 Command not implemented\r\n');
      }
    });
    socket.on('error', () => undefined);
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

  const waitForCode = async (to: string, timeoutMs = 15_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const msg = received.find((m) => m.to.toLowerCase() === to.toLowerCase());
      if (msg) {
        // The code sits alone in a styled div; the first 6-digit run is it.
        const code = msg.body.match(/\b(\d{6})\b/);
        if (code) return code[1];
        throw new Error(`Mail delivered to ${to} but no 6-digit code found in it`);
      }
      await sleep(100);
    }
    throw new Error(`No OTP mail delivered to ${to} within ${timeoutMs}ms`);
  };

  return { server, waitForCode };
}

// ---------------------------------------------------------------------------
// The environment
// ---------------------------------------------------------------------------

interface Issued {
  label: string;
  email: string;
  accessToken: string;
}

async function main() {
  const smokeOnly = process.argv.includes('--smoke');
  const cleanups: (() => void | Promise<void>)[] = [];
  const shutdown = async () => {
    for (const fn of cleanups.reverse()) {
      try {
        await fn();
      } catch {
        /* a teardown failure must not mask the real error */
      }
    }
  };

  try {
    log('\n🧪 QA environment — disposable, seeded, and never production\n');

    // --- database -------------------------------------------------------
    let databaseUrl = process.env.QA_DATABASE_URL;
    if (databaseUrl) {
      assertDisposable(databaseUrl);
      log('  · using the QA_DATABASE_URL supplied by the operator');
    } else {
      log('  · initialising a disposable PostgreSQL cluster…');
      const cluster = await startDisposablePostgres('ahla_qa');
      cleanups.push(cluster.stop);
      databaseUrl = cluster.url;
      log('  ✓ PostgreSQL up — the cluster and its data directory die with this process');
    }
    assertDisposable(databaseUrl);

    // --- environment ----------------------------------------------------
    //
    // Set BEFORE anything imports the app: dotenv does not overwrite variables
    // that already exist, so a developer's own .env cannot redirect this run at
    // a real database or leak a real secret into it.
    const smtpPort = await freePort();
    const apiPort = await freePort();
    const adminPassword = secret(12);

    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      JWT_ACCESS_SECRET: secret(),
      JWT_REFRESH_SECRET: secret(),
      WEBHOOK_SECRET: secret(),
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'qa@ahlashabab.local',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(smtpPort),
      SMTP_USER: '',
      SMTP_PASS: '',
      SEED_ADMIN_PASSWORD: adminPassword,
      SEED_OVERWRITE_CONTENT: 'false',
      UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'ahla-qa-uploads-')),
      CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
      RATE_LIMIT_MAX: '10000', // QA hits the same routes far harder than a user
    });

    // --- schema + data --------------------------------------------------
    log('  · applying migrations…');
    const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      encoding: 'utf8',
      env: process.env,
    });
    if (migrate.status !== 0) throw new Error(`migrate deploy failed:\n${migrate.stdout}${migrate.stderr}`);

    log('  · seeding…');
    const seed = spawnSync('npm', ['run', 'prisma:seed'], { encoding: 'utf8', env: process.env });
    if (seed.status !== 0) throw new Error(`seed failed:\n${seed.stdout}${seed.stderr}`);

    // --- mail catcher ---------------------------------------------------
    const sink = await startMailSink(smtpPort);
    cleanups.push(() => new Promise<void>((r) => sink.server.close(() => r())));
    log(`  ✓ SMTP sink on port ${smtpPort} — OTP mail is captured, not sent`);

    // --- the API itself -------------------------------------------------
    const { NestFactory } = require('@nestjs/core');
    const { ConfigService } = require('@nestjs/config');
    const { AppModule } = require('../src/app.module');
    const { configureApp } = require('../src/bootstrap');
    const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    // The same middleware production gets — prefix, helmet, trust proxy, CORS.
    // This script used to set only the prefix, so the API answered curl and
    // rejected every browser: no CORS meant the dashboard's preflight 404'd and
    // each request failed with net::ERR_FAILED.
    configureApp(app, app.get(ConfigService));
    await app.listen(apiPort, '127.0.0.1');
    cleanups.push(() => app.close());

    const base = `http://127.0.0.1:${apiPort}/api/v1`;
    log(`  ✓ API listening on ${base}\n`);

    const call = (path: string, init: RequestInit = {}, token?: string) =>
      fetch(`${base}/${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      });

    const unwrap = async (res: Response) => {
      const json: any = await res.json().catch(() => ({}));
      return json?.data ?? json;
    };

    // --- issue the tokens, through the real login routes -----------------
    log('  Issuing tokens through the shipped login endpoints:');

    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ahlashabab.com';
    const loginRes = await call('admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const loginBody = await unwrap(loginRes);
    if (loginRes.status !== 200 || !loginBody.accessToken) {
      throw new Error(`admin login failed (${loginRes.status}): ${JSON.stringify(loginBody)}`);
    }
    log('    ✓ admin  — POST /admin/auth/login');

    const issued: Issued[] = [{ label: 'admin', email: adminEmail, accessToken: loginBody.accessToken }];

    for (const label of ['user A', 'user B']) {
      const email = `qa-${label.replace(/\s+/g, '-').toLowerCase()}@ahlashabab.local`;
      const reqRes = await call('auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (reqRes.status !== 200) {
        throw new Error(`OTP request failed for ${email} (${reqRes.status})`);
      }
      const code = await sink.waitForCode(email);
      const verifyRes = await call('auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      const verifyBody = await unwrap(verifyRes);
      if (verifyRes.status !== 200 || !verifyBody.accessToken) {
        throw new Error(`OTP verify failed for ${email} (${verifyRes.status})`);
      }
      issued.push({ label, email, accessToken: verifyBody.accessToken });
      log(`    ✓ ${label} — POST /auth/otp/request → mail captured → /auth/otp/verify`);
    }

    // --- prove the tokens are real ---------------------------------------
    log('\n  Smoke checks:');
    const checks: [string, boolean][] = [];

    const admin = issued[0];
    const userA = issued[1];
    const userB = issued[2];

    const adminList = await call('admin/bookings?limit=1', {}, admin.accessToken);
    checks.push(['admin token reaches an /admin route', adminList.status === 200]);

    const guest = await call('admin/bookings?limit=1');
    checks.push(['a guest is refused (401)', guest.status === 401]);

    const userOnAdmin = await call('admin/bookings?limit=1', {}, userA.accessToken);
    checks.push(['a user token is refused on /admin (401/403)', [401, 403].includes(userOnAdmin.status)]);

    const meA = await call('me', {}, userA.accessToken);
    const meABody = await unwrap(meA);
    checks.push(['user A token reaches GET /me', meA.status === 200 && meABody.email === userA.email]);

    const meB = await call('me', {}, userB.accessToken);
    const meBBody = await unwrap(meB);
    checks.push([
      'the two user tokens are different identities',
      meB.status === 200 && meBBody.email === userB.email && meBBody.id !== meABody.id,
    ]);

    // Not just a 200: an empty list would mean the seed never ran, which is the
    // difference between "an environment" and "an environment QA can use".
    const cases = await call('cases?limit=1');
    const casesBody = await unwrap(cases);
    checks.push([
      'seeded public data is served',
      cases.status === 200 && Array.isArray(casesBody?.data) && casesBody.data.length > 0,
    ]);

    for (const [name, ok] of checks) log(`    ${ok ? '✓' : '✗'} ${name}`);
    const failed = checks.filter(([, ok]) => !ok);

    if (failed.length) {
      log(`\n  ✗ ${failed.length} check(s) failed\n`);
      await shutdown();
      process.exit(1);
    }

    if (smokeOnly) {
      log('\n  ✓ all checks passed — tearing down (--smoke)\n');
      await shutdown();
      process.exit(0);
    }

    // --- hand it over ----------------------------------------------------
    log('\n────────────────────────────────────────────────────────────');
    log(`  Base URL   ${base}`);
    log(`  Swagger    http://127.0.0.1:${apiPort}/api/docs`);
    log(`  Admin      ${adminEmail} / ${adminPassword}`);
    log('');
    for (const t of issued) log(`  ${t.label.padEnd(7)} ${t.accessToken}`);
    log('');
    log('  Access tokens expire in 15 minutes; log in again for a fresh one.');
    log('  Everything here — database, secrets, mail — dies with this process.');
    log('  Ctrl-C to tear down.');
    log('────────────────────────────────────────────────────────────\n');

    process.on('SIGINT', async () => {
      log('\n  · tearing down…');
      await shutdown();
      process.exit(0);
    });
    await new Promise(() => undefined); // stay up
  } catch (err) {
    console.error('\n✗ QA environment failed:', err instanceof Error ? err.message : err);
    await shutdown();
    process.exit(1);
  }
}

void main();
