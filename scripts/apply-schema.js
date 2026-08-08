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
 * So this script decides from the database, not from a guess:
 *
 *   1. `_prisma_migrations` exists  → `prisma migrate deploy`. Normal path.
 *   2. no migrations table, no tables → `prisma migrate deploy`. A fresh database
 *      applies the baseline from empty, which is what CI proves on every push.
 *   3. no migrations table, but tables exist → **stop**. This is the state that
 *      needs a one-time baseline, and it needs a human with database access. The
 *      script prints the exact commands and exits non-zero **without touching the
 *      schema** — no DDL, no `db push` fallback.
 *
 * Case 3 failing the deploy is deliberate. A deploy that cannot apply its schema
 * must not go on to restart the application.
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

    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );

    return { hasMigrationsTable: present === true, tableCount: Number(count) };
  } finally {
    await prisma.$disconnect();
  }
}

function refuse(tableCount) {
  const migrations = require('fs')
    .readdirSync(require('path').join(__dirname, '../prisma/migrations'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  console.error(`
──────────────────────────────────────────────────────────────────────────────
  Refusing to change the schema: this database needs a one-time baseline.

  It holds ${tableCount} tables but has no _prisma_migrations history, which is
  what a database created with 'prisma db push' looks like. Applying the
  migrations now would try to re-create tables that already exist (P3005).

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
  const { hasMigrationsTable, tableCount } = await inspect();

  if (!hasMigrationsTable && tableCount > 0) {
    refuse(tableCount);
    process.exit(1);
  }

  if (!hasMigrationsTable) {
    console.log('· empty database — applying migrations from the baseline');
  }

  run(['prisma', 'migrate', 'deploy']);
}

main().catch((err) => {
  console.error('✗ schema step failed:', err && err.message ? err.message : err);
  process.exit(1);
});
