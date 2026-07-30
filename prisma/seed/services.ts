import { Prisma, PrismaClient } from '@prisma/client';

const SERVICES = [
  {
    id: 'svc-1',
    name: 'جلسة إرشاد نفسي فردي',
    description: 'جلسة استشارة نفسية فردية مع أخصائي متخصص',
    categoryId: 'cat-0-0',
    providerId: 'provider-1',
    free: true,
    requireNationalId: false,
  },
  {
    id: 'svc-2',
    name: 'استشارة أسرية',
    description: 'جلسة استشارة أسرية لحل المشكلات الأسرية',
    categoryId: 'cat-0-1',
    providerId: 'provider-1',
    free: true,
    requireNationalId: false,
  },
  {
    id: 'svc-3',
    name: 'استشارة اجتماعية',
    description: 'جلسة دعم اجتماعي ومساعدة في حل المشكلات',
    categoryId: 'cat-4',
    providerId: 'provider-2',
    free: true,
    requireNationalId: false,
  },
  {
    id: 'svc-4',
    name: 'استشارة قانونية - أحوال شخصية',
    description: 'استشارة قانونية متخصصة في قضايا الأحوال الشخصية',
    categoryId: 'cat-1-0',
    providerId: 'provider-3',
    free: true,
    requireNationalId: true,
  },
  {
    id: 'svc-5',
    name: 'كشف طبي عام',
    description: 'كشف طبي شامل مع طبيب عام',
    categoryId: 'cat-3-0',
    providerId: 'provider-4',
    free: true,
    requireNationalId: true,
  },
  {
    id: 'svc-6',
    name: 'جلسة دعم جماعي',
    description: 'جلسة دعم نفسي جماعية',
    categoryId: 'cat-0-2',
    providerId: 'provider-1',
    free: true,
    requireNationalId: false,
  },
];

const DEFAULT_FORM_FIELDS = [
  { key: 'applicantName', label: 'الاسم', type: 'text', required: true, sortOrder: 0 },
  { key: 'phone', label: 'رقم الهاتف', type: 'phone', required: true, sortOrder: 1 },
  { key: 'age', label: 'العمر', type: 'number', required: false, sortOrder: 2 },
  { key: 'gender', label: 'النوع', type: 'select', required: false, sortOrder: 3, optionsJson: ['ذكر', 'أنثى'] },
  { key: 'governorate', label: 'المحافظة', type: 'governorate', required: false, sortOrder: 4 },
  { key: 'notes', label: 'ملاحظات', type: 'textarea', required: false, sortOrder: 5 },
];

export async function seedServices(prisma: PrismaClient) {
  console.log('  Seeding services...');

  for (const svc of SERVICES) {
    await prisma.service.upsert({
      where: { id: svc.id },
      update: {
        name: svc.name,
        description: svc.description,
        categoryId: svc.categoryId,
        providerId: svc.providerId,
        free: svc.free,
        requireNationalId: svc.requireNationalId,
      },
      create: svc,
    });

    // Seed default form fields for each service
    for (const field of DEFAULT_FORM_FIELDS) {
      await prisma.serviceFormField.upsert({
        where: {
          serviceId_key: { serviceId: svc.id, key: field.key },
        },
        update: {},
        create: {
          serviceId: svc.id,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          sortOrder: field.sortOrder,
          optionsJson: field.optionsJson ?? Prisma.JsonNull,
        },
      });
    }

    // Add nationalId field for services that require it
    if (svc.requireNationalId) {
      await prisma.serviceFormField.upsert({
        where: {
          serviceId_key: { serviceId: svc.id, key: 'nationalId' },
        },
        update: {},
        create: {
          serviceId: svc.id,
          key: 'nationalId',
          label: 'الرقم القومي',
          type: 'text',
          required: true,
          sortOrder: 6,
        },
      });
    }
  }

  console.log(`  ✓ ${SERVICES.length} services with form fields`);
}
