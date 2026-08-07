import { PrismaClient } from '@prisma/client';

/**
 * The single guarded entry point for integration tests.
 *
 * These suites CREATE, MUTATE and DELETE rows. Pointed at the wrong database
 * they would destroy real donations and bookings, so the safety check lives in
 * one place rather than being re-written per spec.
 *
 * The rule is a **positive allowlist on the database name**: it must look like a
 * throwaway (`..._test`, `..._int`, or containing `test`/`integration`). A
 * blocklist was tried first — refuse anything matching `prod` or the API host —
 * and it is the wrong shape: it passes by default, so any production database
 * whose name nobody thought of would be accepted and wiped. This fails by
 * default instead.
 *
 * Note `@prisma/client` loads `.env` when it is imported, so a developer's local
 * `DATABASE_URL` is in effect here even when the shell did not export one. That
 * is exactly why the name check matters: without it, running the integration
 * suite with a production `.env` present would be silently destructive.
 */
export function integrationDb(): PrismaClient {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Integration tests need a disposable PostgreSQL — ' +
        'see qa/final-delivery-audit/logs/ for the runbook.',
    );
  }

  // Strip credentials before anything is printed, so a failure never leaks a password.
  const dbName = (() => {
    try {
      return new URL(url).pathname.replace(/^\//, '').split('?')[0];
    } catch {
      return '';
    }
  })();

  const looksDisposable = /(^|[_-])(test|int|integration)([_-]|$)|test|integration/i.test(dbName);

  if (!looksDisposable) {
    throw new Error(
      `Refusing to run destructive integration tests against database "${dbName}". ` +
        'The name must identify it as disposable (e.g. ahla_test, ahla_int). ' +
        'This check fails closed on purpose — these tests delete rows.',
    );
  }

  return new PrismaClient({ datasources: { db: { url } } });
}
