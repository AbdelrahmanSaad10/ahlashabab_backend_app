import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { createServer } from 'net';
import { join } from 'path';

/**
 * A PostgreSQL cluster that exists only for the life of a command.
 *
 * The integration suites need a real database — a race condition, a Serializable
 * transaction and a foreign key cannot be proven against a mock — and they
 * CREATE, MUTATE and DELETE freely. CI gets a `services: postgres` container;
 * locally the harness kept being re-derived by hand, which is how a destructive
 * suite ends up pointed at somebody's development database.
 *
 * So it lives here, used by `scripts/qa-env.ts` and `scripts/with-db.ts`.
 */

const PG_CANDIDATES = [
  '/opt/homebrew/opt/postgresql@15/bin',
  '/usr/local/opt/postgresql@15/bin',
  '/usr/lib/postgresql/16/bin',
  '/usr/lib/postgresql/15/bin',
];

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as any).port as number;
      srv.close(() => resolve(port));
    });
  });
}

function pgBin(): string {
  for (const dir of PG_CANDIDATES) if (existsSync(join(dir, 'initdb'))) return dir;
  const which = spawnSync('which', ['initdb'], { encoding: 'utf8' });
  if (which.status === 0) return join(which.stdout.trim(), '..');
  throw new Error(
    'No PostgreSQL binaries found. Install postgresql@15 (brew install postgresql@15), ' +
      'or point DATABASE_URL at a disposable database yourself.',
  );
}

export interface DisposableCluster {
  /** Connection string for a freshly created, empty database. */
  url: string;
  /** Stops the server and deletes the data directory. Safe to call twice. */
  stop: () => void;
}

/**
 * Starts a cluster in a temp directory and creates one empty database in it.
 *
 * The data directory goes under /tmp deliberately: a unix socket path is capped
 * at ~103 bytes and macOS's default temp directory is long enough to exceed that
 * on its own. The locale is forced to C for the same reason it is in CI —
 * `initdb` fails on some machines when it inherits a UTF-8 locale, and the
 * *server* process needs it too, not just initdb.
 */
export async function startDisposablePostgres(dbName = 'ahla_qa'): Promise<DisposableCluster> {
  const bin = pgBin();
  const dataDir = mkdtempSync(join('/tmp', 'ahla-pg-'));
  const port = await freePort();
  const env = { ...process.env, LC_ALL: 'C', LANG: 'C' };

  const init = spawnSync(
    join(bin, 'initdb'),
    ['-D', dataDir, '-U', 'postgres', '--locale=C', '--encoding=UTF8'],
    { env, encoding: 'utf8' },
  );
  if (init.status !== 0) throw new Error(`initdb failed:\n${init.stderr}`);

  const start = spawnSync(
    join(bin, 'pg_ctl'),
    [
      '-D', dataDir,
      '-l', join(dataDir, 'server.log'),
      '-o', `-p ${port} -k ${dataDir} -h 127.0.0.1`,
      '-w', 'start',
    ],
    { env, encoding: 'utf8' },
  );
  if (start.status !== 0) throw new Error(`pg_ctl start failed:\n${start.stdout}${start.stderr}`);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    spawnSync(join(bin, 'pg_ctl'), ['-D', dataDir, '-m', 'immediate', 'stop'], { env });
    rmSync(dataDir, { recursive: true, force: true });
  };

  try {
    const create = spawnSync(
      join(bin, 'createdb'),
      ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', dbName],
      { env, encoding: 'utf8' },
    );
    if (create.status !== 0) throw new Error(`createdb failed:\n${create.stderr}`);
  } catch (e) {
    stop();
    throw e;
  }

  return {
    url: `postgresql://postgres@127.0.0.1:${port}/${dbName}?schema=public`,
    stop,
  };
}

/**
 * The same rule the integration suites apply, in one place.
 *
 * A positive allowlist on the database NAME. A blocklist was tried first and is
 * the wrong shape: it passes by default, so any real database whose name nobody
 * thought of would be accepted and wiped. This fails closed.
 */
export function assertDisposable(url: string): void {
  const name = (() => {
    try {
      return new URL(url).pathname.replace(/^\//, '').split('?')[0];
    } catch {
      return '';
    }
  })();

  if (!/(^|[_-])(test|int|integration|qa)([_-]|$)|test|integration|qa/i.test(name)) {
    throw new Error(
      `Refusing to use database "${name}" — it will be seeded, mutated and deleted from. ` +
        'The name must identify it as disposable (e.g. ahla_qa, ahla_test).',
    );
  }
}
