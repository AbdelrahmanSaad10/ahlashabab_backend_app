#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Apply the schema at deploy time — safely.
 *
 * `deploy.yml` ran `prisma db push --skip-generate` on every push to main, even
 * after T-01 baselined the migrations. `db push` has no history, no review step
 * and no plan: it issues whatever DDL makes the database match `schema.prisma`,
 * **including dropping and rewriting columns**, against a live database holding
 * donations and beneficiary records.
 *
 * The obvious replacement — swapping in `migrate deploy` — fails outright.
 * Production's schema was created by `db push`, so it has no `_prisma_migrations`
 * table, and Prisma refuses with **P3005: the database schema is not empty**.
 * Verified by reproducing that exact state on a disposable cluster.
 *
 * So this script decides from the database, not from a guess.
 *
 * The first version of it decided on whether `_prisma_migrations` **exists**, and
 * that was wrong. Production had the table with **no applied rows** — a state I
 * had not considered and had not tested — so the script took the deploy path and
 * `migrate deploy` tried to create `governorates` on top of the live schema.
 * Nothing was lost (PostgreSQL migrations run in a transaction, and it failed on
 * its first statement) but it recorded `0_init` as **failed**, which blocks every
 * later migration until a human clears it. The lesson is in the check below:
 * "a migrations table" is not "a baselined database".
 *
 *   1. a migration is recorded FAILED       → stop, print the recovery command
 *   2. no applied migrations, tables exist  → stop, print the baseline commands
 *   3. no applied migrations, no tables     → `prisma migrate deploy` from empty
 *   4. otherwise                            → `prisma migrate deploy`
 *
 * Cases 1 and 2 exit non-zero **without touching the schema** — no DDL, no `db
 * push` fallback. The deploy script sets `set -e` so that actually stops the
 * deploy: without it the workflow carried on to seed and restart the app, and
 * reported success.
 *
 * Plain JavaScript, not TypeScript: this runs on the server straight after
 * `npm install`, and must not depend on ts-node or on a build having succeeded.
 */

const { execFileSync } = require('child_process');

const run = (args) => execFileSync('npx', args, { stdio: 'inherit' });

async function inspect() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const [{ present }] = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
    );
    const hasMigrationsTable = present === true;

    // The application's own tables. `_prisma_migrations` is excluded: a database
    // holding nothing but the bookkeeping table is still an empty database.
    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'`,
    );

    let applied = 0;
    let failed = [];

    if (hasMigrationsTable) {
      /*
       * Prisma's own bookkeeping:
       *   applied → finished_at set, never rolled back
       *   failed  → started, never finished, not rolled back
       *
       * A failed row is what blocks `migrate deploy` with P3018, and it is what
       * a half-finished attempt leaves behind. Reading it here is the difference
       * between a deploy that explains itself and one that repeats the failure.
       */
      const [{ n }] = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM _prisma_migrations
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
      );
      applied = Number(n);

      failed = (
        await prisma.$queryRawUnsafe(
          `SELECT migration_name FROM _prisma_migrations
            WHERE finished_at IS NULL AND rolled_back_at IS NULL
            ORDER BY started_at`,
        )
      ).map((r) => r.migration_name);
    }

    return { hasMigrationsTable, tableCount: Number(count), applied, failed };
  } finally {
    await prisma.$disconnect();
  }
}

function migrationNames() {
  return require('fs')
    .readdirSync(require('path').join(__dirname, '../prisma/migrations'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function refuseFailed(failed) {
  console.error(`
──────────────────────────────────────────────────────────────────────────────
  Refusing to change the schema: a migration is recorded as FAILED.

    ${failed.join('\n    ')}

  Prisma blocks every later migration until this is cleared (P3018), and
  re-running the deploy will only hit the same wall. Nothing has been changed.

  If the schema is intact — which it is when the migration failed because the
  objects already existed — mark the attempt rolled back, then baseline:

      npx prisma migrate resolve --rolled-back ${failed[0]}
${migrationNames()
  .map((m) => `      npx prisma migrate resolve --applied ${m}`)
  .join('\n')}

      npx prisma migrate status     # expect: Database schema is up to date!

  Check the schema before doing this. 'resolve --rolled-back' tells Prisma the
  migration left no trace; if it had partially applied, that would be a lie and
  the next migration would run against a schema nobody has described.
──────────────────────────────────────────────────────────────────────────────
`);
}

function refuse(tableCount) {
  const migrations = migrationNames();

  console.error(`
──────────────────────────────────────────────────────────────────────────────
  Refusing to change the schema: this database needs a one-time baseline.

  It holds ${tableCount} application tables but no applied migrations, which is
  what a database created with 'prisma db push' looks like — with or without an
  empty _prisma_migrations table sitting alongside. Applying the migrations now
  would try to re-create tables that already exist.

  Nothing has been changed. Run this ONCE, with DATABASE_URL pointing at this
  database. It records the migrations as already applied and executes NO SQL:

${migrations.map((m) => `      npx prisma migrate resolve --applied ${m}`).join('\n')}

      npx prisma migrate status     # expect: Database schema is up to date!

  Then re-run the deploy. Every deploy after that applies migrations normally.

  Baseline the migrations in the order listed — each one is recorded against
  the schema state the previous one left behind.
──────────────────────────────────────────────────────────────────────────────
`);
}

async function main() {
  const { tableCount, applied, failed } = await inspect();

  if (failed.length > 0) {
    refuseFailed(failed);
    process.exit(1);
  }

  // Not "is there a migrations table" — "has any migration actually been
  // applied". An empty table on a populated schema is precisely the state that
  // needs baselining, and treating it as healthy is what broke the first deploy.
  if (applied === 0 && tableCount > 0) {
    refuse(tableCount);
    process.exit(1);
  }

  if (applied === 0) {
    console.log('· empty database — applying migrations from the baseline');
  }

  run(['prisma', 'migrate', 'deploy']);
}

main().catch((err) => {
  console.error('✗ schema step failed:', err && err.message ? err.message : err);
  process.exit(1);
});
