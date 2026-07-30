import { PrismaClient } from '@prisma/client';

const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'البحر الأحمر',
  'البحيرة',
  'الفيوم',
  'الغربية',
  'الإسماعيلية',
  'المنوفية',
  'المنيا',
  'القليوبية',
  'الوادي الجديد',
  'السويس',
  'أسوان',
  'أسيوط',
  'بني سويف',
  'بورسعيد',
  'دمياط',
  'الشرقية',
  'جنوب سيناء',
  'كفر الشيخ',
  'مطروح',
  'الأقصر',
  'قنا',
  'شمال سيناء',
  'سوهاج',
];

export async function seedGovernorates(prisma: PrismaClient) {
  console.log('  Seeding governorates...');
  for (const name of GOVERNORATES) {
    await prisma.governorate.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`  ✓ ${GOVERNORATES.length} governorates`);
}

// Work areas — the governorates where the foundation operates
const WORK_GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'البحيرة',
  'الغربية',
  'المنوفية',
  'المنيا',
  'القليوبية',
  'أسيوط',
  'بني سويف',
  'الشرقية',
];

export async function seedWorkAreas(prisma: PrismaClient) {
  console.log('  Seeding work areas...');
  for (let i = 0; i < WORK_GOVERNORATES.length; i++) {
    const gov = await prisma.governorate.findUnique({
      where: { name: WORK_GOVERNORATES[i] },
    });
    if (gov) {
      await prisma.workArea.upsert({
        where: { governorateId: gov.id },
        update: { sortOrder: i },
        create: { governorateId: gov.id, sortOrder: i },
      });
    }
  }
  console.log(`  ✓ ${WORK_GOVERNORATES.length} work areas`);
}
