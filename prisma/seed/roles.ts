import { PrismaClient } from '@prisma/client';

const ROLES = [
  {
    name: 'مدير عام',
    description: 'صلاحيات كاملة على النظام',
    permissionsJson: {
      portfolio: { read: true, write: true },
      services: { read: true, write: true },
      providers: { read: true, write: true },
      bookings: { read: true, write: true },
      users: { read: true, write: true },
      reports: { read: true, write: true },
      roles: { read: true, write: true },
      cms: { read: true, write: true },
      donations: { read: true, write: true },
    },
  },
  {
    name: 'مدير محتوى',
    description: 'إدارة المحتوى والمقالات والمشاريع',
    permissionsJson: {
      portfolio: { read: true, write: true },
      services: { read: true, write: false },
      providers: { read: true, write: false },
      bookings: { read: true, write: false },
      users: { read: true, write: false },
      reports: { read: true, write: false },
      roles: { read: false, write: false },
      cms: { read: true, write: true },
      donations: { read: true, write: false },
    },
  },
  {
    name: 'مدير حجوزات',
    description: 'إدارة الحجوزات والمواعيد',
    permissionsJson: {
      portfolio: { read: true, write: false },
      services: { read: true, write: true },
      providers: { read: true, write: true },
      bookings: { read: true, write: true },
      users: { read: true, write: false },
      reports: { read: true, write: false },
      roles: { read: false, write: false },
      cms: { read: true, write: false },
      donations: { read: true, write: false },
    },
  },
  {
    name: 'اطّلاع فقط',
    description: 'قراءة فقط بدون تعديل',
    permissionsJson: {
      portfolio: { read: true, write: false },
      services: { read: true, write: false },
      providers: { read: true, write: false },
      bookings: { read: true, write: false },
      users: { read: true, write: false },
      reports: { read: true, write: false },
      roles: { read: true, write: false },
      cms: { read: true, write: false },
      donations: { read: true, write: false },
    },
  },
];

export async function seedRoles(prisma: PrismaClient) {
  console.log('  Seeding roles...');
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissionsJson: role.permissionsJson },
      create: role,
    });
  }
  console.log(`  ✓ ${ROLES.length} roles`);
}
