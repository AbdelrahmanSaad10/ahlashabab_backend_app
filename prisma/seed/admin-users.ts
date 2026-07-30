import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

export async function seedAdminUsers(prisma: PrismaClient) {
  console.log('  Seeding admin users...');

  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'مدير عام' },
  });

  if (!superAdminRole) {
    console.log('  ⚠ Super admin role not found, skipping admin users seed');
    return;
  }

  const passwordHash = await argon2.hash('admin123');

  await prisma.adminUser.upsert({
    where: { email: 'admin@ahlashabab.com' },
    update: {},
    create: {
      name: 'مدير النظام',
      email: 'admin@ahlashabab.com',
      passwordHash,
      roleId: superAdminRole.id,
      active: true,
    },
  });

  console.log('  ✓ 1 admin user (admin@ahlashabab.com / admin123)');
}
