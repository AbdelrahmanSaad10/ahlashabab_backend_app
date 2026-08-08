import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as argon2 from 'argon2';
import { seedAdminUsers } from '../prisma/seed/admin-users';

/**
 * The first-admin credential — T-06.
 *
 * This seed hashed a hardcoded `admin123`, in a **public** repository, and
 * `deploy.yml` runs `prisma db seed` on every push to main. The account it
 * created holds «مدير عام»: every permission, over donations, beneficiaries and
 * national IDs. The credential was confirmed working against the production API
 * before it was changed.
 *
 * These tests pin the two properties that stop it coming back: an existing admin
 * is never touched, and no admin is ever created from a password that lives in
 * the source tree.
 */

const ROLE_ID = 'role-super-admin';

function fakePrisma(existingAdmin: unknown = null) {
  const created: any[] = [];
  return {
    created,
    client: {
      role: { findUnique: async () => ({ id: ROLE_ID, name: 'مدير عام' }) },
      adminUser: {
        findUnique: async () => existingAdmin,
        create: async ({ data }: any) => {
          created.push(data);
          return { id: 'new-admin', ...data };
        },
      },
    } as any,
  };
}

/** Captures the seed's stdout so the generated password can be inspected. */
async function run(prisma: any) {
  const lines: string[] = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...a) => {
    lines.push(a.join(' '));
  });
  try {
    await seedAdminUsers(prisma);
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n');
}

describe('the first administrator account', () => {
  const ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV };
  });

  it('never creates an account when no password is supplied in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SEED_ADMIN_PASSWORD;

    const { client, created } = fakePrisma(null);
    const output = await run(client);

    // Creating none is recoverable — the operator sets the variable and re-runs.
    // Creating one with a password anyone can read off GitHub is not.
    expect(created).toHaveLength(0);
    expect(output).toContain('SEED_ADMIN_PASSWORD');
  });

  it('uses the supplied password, and only that', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_ADMIN_PASSWORD = 'a-password-chosen-by-the-operator';

    const { client, created } = fakePrisma(null);
    await run(client);

    expect(created).toHaveLength(1);
    expect(created[0].roleId).toBe(ROLE_ID);
    await expect(
      argon2.verify(created[0].passwordHash, 'a-password-chosen-by-the-operator'),
    ).resolves.toBe(true);
  });

  it('never writes the supplied password to the log', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_ADMIN_PASSWORD = 'a-password-chosen-by-the-operator';

    const output = await run(fakePrisma(null).client);
    expect(output).not.toContain('a-password-chosen-by-the-operator');
  });

  it('generates a different random password on every non-production run', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SEED_ADMIN_PASSWORD;

    const passwordFrom = (output: string) =>
      (output.match(/generated password \(shown once\): (\S+)/) ?? [])[1];

    const first = fakePrisma(null);
    const a = passwordFrom(await run(first.client));
    const second = fakePrisma(null);
    const b = passwordFrom(await run(second.client));

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b); // no constant, not even a per-environment one
    expect(a!.length).toBeGreaterThanOrEqual(16);
    await expect(argon2.verify(first.created[0].passwordHash, a!)).resolves.toBe(true);
  });

  it('leaves an existing administrator completely alone', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SEED_ADMIN_PASSWORD = 'something-new';

    // A deploy runs this on every push. It must not reset a changed password,
    // and must not re-enable an account somebody deliberately disabled.
    const { client, created } = fakePrisma({
      id: 'existing',
      email: 'admin@ahlashabab.com',
      active: false,
    });
    const output = await run(client);

    expect(created).toHaveLength(0);
    expect(output).toContain('left untouched');
  });
});

describe('no password constant survives in the seed', () => {
  /*
   * The behavioural tests above would still pass if someone re-introduced a
   * default by assigning it to `SEED_ADMIN_PASSWORD` inside the source. This
   * reads the file, which is the level the original defect lived at.
   */
  it('the seed contains no literal password', () => {
    // Comments are stripped first: the file explains the defect by name, and a
    // guard that trips on its own documentation teaches people to delete the
    // documentation.
    const source = readFileSync(join(__dirname, '../prisma/seed/admin-users.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(source).not.toMatch(/admin123/);
    // argon2.hash must be handed a variable, never a string literal.
    expect(source).not.toMatch(/argon2\.hash\(\s*['"`]/);
    // and nothing may pre-fill the environment variable with a default.
    expect(source).not.toMatch(/SEED_ADMIN_PASSWORD\s*(\?\?|\|\|)\s*['"`]/);
  });
});
