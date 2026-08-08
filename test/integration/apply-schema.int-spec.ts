import 'reflect-metadata';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { startDisposablePostgres, DisposableCluster } from '../../scripts/disposable-postgres';

/**
 * The deploy-time schema step, against real databases in each state it can meet.
 *
 * `deploy.yml` ran `prisma db push` on every push to main — after T-01 baselined
 * the migrations — so production's schema was still being forced into shape with
 * no history and no review step, on a live database holding donations and
 * beneficiary records.
 *
 * Swapping in `migrate deploy` alone would have failed every deploy: production
 * was created by `db push`, so it has no `_prisma_migrations` table and Prisma
 * refuses with **P3005**. That is not a hypothetical — it is reproduced below.
 *
 * These suites build each state on its own throwaway cluster, so the assertions
 * are about what actually happens rather than what the docs claim.
 */

const SCRIPT = join(__dirname, '../../scripts/apply-schema.js');

const applySchema = (url: string) =>
  spawnSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: url },
  });

const prismaCli = (url: string, args: string[]) =>
  spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: url },
  });

/** Reads the two facts the script decides on, straight from the database. */
async function inspect(url: string) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [{ present }] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
    );
    const [{ count }] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int AS count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    return { hasMigrationsTable: present === true, tableCount: Number(count) };
  } finally {
    await prisma.$disconnect();
  }
}

describe('a fresh database', () => {
  let cluster: DisposableCluster;
  beforeAll(async () => {
    cluster = await startDisposablePostgres('ahla_test');
  });
  afterAll(() => cluster?.stop());

  it('applies the migrations from the baseline', async () => {
    const before = await inspect(cluster.url);
    expect(before.tableCount).toBe(0);

    const result = applySchema(cluster.url);
    expect(result.status).toBe(0);

    const after = await inspect(cluster.url);
    expect(after.hasMigrationsTable).toBe(true);
    // 38 models + _prisma_migrations. Asserted loosely: the point is that the
    // baseline built the schema, not the exact model count on any given day.
    expect(after.tableCount).toBeGreaterThan(30);
  }, 120_000);
});

describe("a database created with 'db push' — production's actual state", () => {
  let cluster: DisposableCluster;

  beforeAll(async () => {
    cluster = await startDisposablePostgres('ahla_test');
    // Exactly what deploy.yml has been doing on every push to main.
    const push = prismaCli(cluster.url, ['db', 'push', '--skip-generate']);
    expect(push.status).toBe(0);
  }, 120_000);
  afterAll(() => cluster?.stop());

  it('has the tables but no migration history — which is why P3005 happens', async () => {
    const state = await inspect(cluster.url);
    expect(state.tableCount).toBeGreaterThan(30);
    expect(state.hasMigrationsTable).toBe(false);

    // The failure the naive fix would have shipped, reproduced.
    const deploy = prismaCli(cluster.url, ['migrate', 'deploy']);
    expect(deploy.status).not.toBe(0);
    expect(`${deploy.stdout}${deploy.stderr}`).toContain('P3005');
  }, 120_000);

  it('is refused, with the exact baseline commands and no schema change', async () => {
    const before = await inspect(cluster.url);

    const result = applySchema(cluster.url);
    expect(result.status).toBe(1);

    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain('one-time baseline');
    // Both migrations, not just 0_init — the runbook written at T-01 named only
    // the baseline, and a second migration has landed since.
    expect(output).toContain('migrate resolve --applied 0_init');
    expect(output).toContain('migrate resolve --applied 20260807211405_donation_case_project_links');

    // Nothing was touched: no DDL, and no silent fall back to `db push`.
    expect(await inspect(cluster.url)).toEqual(before);
  }, 120_000);

  it('proceeds normally once the baseline has been recorded', async () => {
    for (const name of ['0_init', '20260807211405_donation_case_project_links']) {
      const resolved = prismaCli(cluster.url, ['migrate', 'resolve', '--applied', name]);
      expect(resolved.status).toBe(0);
    }

    const result = applySchema(cluster.url);
    expect(result.status).toBe(0);

    const status = prismaCli(cluster.url, ['migrate', 'status']);
    expect(`${status.stdout}`).toContain('up to date');
  }, 120_000);
});
