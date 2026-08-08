import { spawnSync } from 'child_process';
import { startDisposablePostgres } from './disposable-postgres';

/**
 * Run any command against a disposable, migrated, seeded PostgreSQL.
 *
 *   npm run test:int:local            # the integration suites
 *   npm run with-db -- npx prisma studio
 *
 * The database is created, migrated and destroyed around the command, so the
 * integration suites cannot be pointed at a real database by an inherited
 * `DATABASE_URL` or a stale `.env` — the one they get is the one created here.
 */

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('usage: with-db <command> [args…]');
    process.exit(2);
  }

  const cluster = await startDisposablePostgres('ahla_test');
  const env = {
    ...process.env,
    DATABASE_URL: cluster.url,
    NODE_ENV: 'test',
    /*
     * The same throwaway values CI exports. Without them the suites inherit
     * whatever a developer's `.env` happens to hold — and an empty
     * `WEBHOOK_SECRET` there makes the webhook endpoint fail closed (T-11), so
     * the payment suite fails for a reason that has nothing to do with the code.
     * These sign and verify only within this run.
     */
    JWT_ACCESS_SECRET: 'local-int-access-secret-long-enough',
    JWT_REFRESH_SECRET: 'local-int-refresh-secret-long-enough',
    WEBHOOK_SECRET: 'local-int-webhook-secret-at-least-16-chars',
    // The seed refuses to invent a password; supply one so the run is quiet and
    // deterministic. It never leaves this process — the database dies with it.
    SEED_ADMIN_PASSWORD: 'disposable-local-password',
  };

  const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { env, stdio: 'inherit', shell: process.platform === 'win32' });

  try {
    console.log('· applying migrations to the disposable database…');
    if (run('npx', ['prisma', 'migrate', 'deploy']).status !== 0) {
      throw new Error('prisma migrate deploy failed');
    }

    console.log('· seeding…');
    // Reference data the suites rely on — services, governorates, roles — comes
    // from the seed, so it has to run before the tests, not alongside them.
    if (run('npm', ['run', 'prisma:seed']).status !== 0) {
      throw new Error('seed failed');
    }

    console.log(`· running: ${argv.join(' ')}\n`);
    const result = run(argv[0], argv.slice(1));
    process.exitCode = result.status ?? 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    cluster.stop();
  }
}

void main();
