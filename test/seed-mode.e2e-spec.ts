import 'reflect-metadata';

/**
 * `deploy.yml` runs `npx prisma db seed` on EVERY push to main, so whatever the
 * seed's `update:` branch contains is written over live rows on every deploy.
 * Several seeds carried a populated one, which silently reset admin-authored
 * data: the whole CMS document, `Role.permissionsJson` (a *tightened* role was
 * widened back to defaults — a security regression, not just lost content),
 * category/service/provider/FAQ/foundation-stat text, and provider rating and
 * reviews.
 *
 * `preserve()` is what changed the default to "create if missing, leave alone if
 * present". The flag is read at module load, so each case re-imports the module
 * with the environment it wants.
 */
describe('seed overwrite mode', () => {
  const load = (value?: string) => {
    jest.resetModules();
    const prev = process.env.SEED_OVERWRITE_CONTENT;
    if (value === undefined) delete process.env.SEED_OVERWRITE_CONTENT;
    else process.env.SEED_OVERWRITE_CONTENT = value;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../prisma/seed/seed-mode');
    if (prev === undefined) delete process.env.SEED_OVERWRITE_CONTENT;
    else process.env.SEED_OVERWRITE_CONTENT = prev;
    return mod as typeof import('../prisma/seed/seed-mode');
  };

  const PAYLOAD = { name: 'default', permissionsJson: { cms: { read: true, write: true } } };

  it('preserves admin-edited rows by default — the deploy must not clobber them', () => {
    const { preserve, SEED_OVERWRITE_CONTENT } = load(undefined);
    expect(SEED_OVERWRITE_CONTENT).toBe(false);
    // An empty update is what makes Prisma's upsert a no-op on an existing row.
    expect(preserve(PAYLOAD)).toEqual({});
  });

  it('still preserves when the flag is present but not exactly "true"', () => {
    for (const v of ['false', '1', 'yes', 'TRUE', '']) {
      expect(load(v).preserve(PAYLOAD)).toEqual({});
    }
  });

  it('overwrites only on an explicit SEED_OVERWRITE_CONTENT=true', () => {
    const { preserve, SEED_OVERWRITE_CONTENT } = load('true');
    expect(SEED_OVERWRITE_CONTENT).toBe(true);
    expect(preserve(PAYLOAD)).toEqual(PAYLOAD);
  });

  it('announces which mode ran, so a deploy log is not ambiguous', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      load('true').logSeedMode();
      expect(spy.mock.calls.flat().join(' ')).toContain('OVERWRITE');
      spy.mockClear();
      load(undefined).logSeedMode();
      expect(spy.mock.calls.flat().join(' ')).toContain('preserving');
    } finally {
      spy.mockRestore();
    }
  });
});
