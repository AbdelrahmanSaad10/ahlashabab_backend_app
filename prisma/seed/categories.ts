import { PrismaClient } from '@prisma/client';
import { preserve } from './seed-mode';

const CATEGORIES = [
  {
    name: 'الاستشارات النفسية',
    icon: 'brain',
    description: 'خدمات الدعم النفسي والاستشارات',
    sortOrder: 0,
    children: [
      { name: 'استشارات فردية', icon: 'user', sortOrder: 0 },
      { name: 'استشارات أسرية', icon: 'users', sortOrder: 1 },
      { name: 'استشارات جماعية', icon: 'people', sortOrder: 2 },
    ],
  },
  {
    name: 'الاستشارات القانونية',
    icon: 'scale',
    description: 'خدمات المساعدة القانونية',
    sortOrder: 1,
    children: [
      { name: 'أحوال شخصية', icon: 'file-text', sortOrder: 0 },
      { name: 'قضايا عمالية', icon: 'briefcase', sortOrder: 1 },
    ],
  },
  {
    name: 'الدعم التعليمي',
    icon: 'book',
    description: 'خدمات التعليم والتدريب',
    sortOrder: 2,
    children: [
      { name: 'دروس تقوية', icon: 'edit', sortOrder: 0 },
      { name: 'تدريب مهني', icon: 'tool', sortOrder: 1 },
    ],
  },
  {
    name: 'الخدمات الطبية',
    icon: 'heart',
    description: 'خدمات الرعاية الصحية',
    sortOrder: 3,
    children: [
      { name: 'كشف طبي', icon: 'stethoscope', sortOrder: 0 },
      { name: 'علاج طبيعي', icon: 'activity', sortOrder: 1 },
    ],
  },
  {
    name: 'الدعم الاجتماعي',
    icon: 'home',
    description: 'خدمات التأهيل والدعم الاجتماعي',
    sortOrder: 4,
  },
  {
    name: 'برامج التوعية',
    icon: 'info',
    description: 'حملات وبرامج التوعية المجتمعية',
    sortOrder: 5,
  },
];

export async function seedCategories(prisma: PrismaClient) {
  console.log('  Seeding categories...');
  let count = 0;

  for (const cat of CATEGORIES) {
    const parent = await prisma.serviceCategory.upsert({
      where: { id: `cat-${cat.sortOrder}` },
      update: preserve({ name: cat.name, icon: cat.icon, description: cat.description, sortOrder: cat.sortOrder }),
      create: {
        id: `cat-${cat.sortOrder}`,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        sortOrder: cat.sortOrder,
      },
    });
    count++;

    if (cat.children) {
      for (const child of cat.children) {
        await prisma.serviceCategory.upsert({
          where: { id: `cat-${cat.sortOrder}-${child.sortOrder}` },
          update: preserve({ name: child.name, icon: child.icon, parentId: parent.id, sortOrder: child.sortOrder }),
          create: {
            id: `cat-${cat.sortOrder}-${child.sortOrder}`,
            name: child.name,
            icon: child.icon,
            parentId: parent.id,
            sortOrder: child.sortOrder,
          },
        });
        count++;
      }
    }
  }

  console.log(`  ✓ ${count} categories`);
}
