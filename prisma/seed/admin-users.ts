import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * The first administrator account.
 *
 * This seed used to hash a hardcoded `admin123` — in a repository that is
 * **public** — and `deploy.yml` runs `prisma db seed` on every push to main. The
 * result was a live super-admin account («مدير النظام», every permission) whose
 * password anyone could read off GitHub. It was confirmed working against the
 * production API. See qa/final-delivery-audit/security/T-06-credentials.md.
 *
 * Two rules now hold:
 *
 * 1. **An existing admin is never touched.** No password reset, no reactivation
 *    of a disabled account — a deploy must not be able to undo a credential
 *    change or a lockout.
 * 2. **No account is created without a password supplied from the environment.**
 *    In production a missing `SEED_ADMIN_PASSWORD` means no admin is created at
 *    all, loudly. Creating none is recoverable; creating one with a published
 *    password is not.
 *
 * Outside production a random password is generated and printed once, so local
 * development keeps working without a constant that could ever be deployed.
 */

const FIRST_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@ahlashabab.com';

/** ~103 bits, no ambiguous glyphs to mistype when it is read off a terminal once. */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(20);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export async function seedAdminUsers(prisma: PrismaClient) {
  console.log('  Seeding admin users...');

  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'مدير عام' },
  });

  if (!superAdminRole) {
    console.log('  ⚠ Super admin role not found, skipping admin users seed');
    return;
  }

  // Rule 1: an existing administrator is left exactly as it is.
  const existing = await prisma.adminUser.findUnique({
    where: { email: FIRST_ADMIN_EMAIL },
  });
  if (existing) {
    console.log(`  · admin ${FIRST_ADMIN_EMAIL} already exists — password left untouched`);
    return;
  }

  // Rule 2: no password from the environment, no account.
  const supplied = process.env.SEED_ADMIN_PASSWORD;

  if (!supplied && process.env.NODE_ENV === 'production') {
    console.log(
      '  ⚠ No admin user exists and SEED_ADMIN_PASSWORD is not set — refusing to create one.\n' +
        '    Set SEED_ADMIN_PASSWORD in the server environment and re-run the seed once.\n' +
        '    (A default password would be readable by anyone with the repository.)',
    );
    return;
  }

  const password = supplied ?? generatePassword();
  const passwordHash = await argon2.hash(password);

  await prisma.adminUser.create({
    data: {
      name: 'مدير النظام',
      email: FIRST_ADMIN_EMAIL,
      passwordHash,
      roleId: superAdminRole.id,
      active: true,
    },
  });

  if (supplied) {
    console.log(`  ✓ 1 admin user (${FIRST_ADMIN_EMAIL}, password from SEED_ADMIN_PASSWORD)`);
  } else {
    // Printed once, to a developer's own terminal, for a non-production database.
    console.log(`  ✓ 1 admin user (${FIRST_ADMIN_EMAIL})`);
    console.log(`    generated password (shown once): ${password}`);
  }
}
