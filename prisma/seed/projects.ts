import { PrismaClient } from '@prisma/client';

const PROJECTS = [
  {
    id: 'proj-1',
    title: 'مشروع إفطار صائم',
    description: 'توزيع وجبات إفطار على الصائمين خلال شهر رمضان في المناطق الأكثر احتياجاً',
    status: 'جاري التنفيذ',
    category: 'إغاثة',
    timeline: 'رمضان 2026',
    targetAmount: 200000,
    raisedAmount: 145000,
    supporters: 230,
    published: true,
    stages: [
      { label: 'التخطيط والتحضير', done: true, sortOrder: 0 },
      { label: 'جمع التبرعات', done: true, sortOrder: 1 },
      { label: 'التنفيذ والتوزيع', done: false, sortOrder: 2 },
      { label: 'التقرير النهائي', done: false, sortOrder: 3 },
    ],
  },
  {
    id: 'proj-2',
    title: 'مشروع كسوة الشتاء',
    description: 'توفير ملابس شتوية للأسر المحتاجة في المحافظات الأكثر برودة',
    status: 'مكتمل',
    category: 'إغاثة',
    timeline: 'شتاء 2025',
    targetAmount: 100000,
    raisedAmount: 100000,
    supporters: 180,
    published: true,
    stages: [
      { label: 'جمع التبرعات', done: true, sortOrder: 0 },
      { label: 'شراء الملابس', done: true, sortOrder: 1 },
      { label: 'التوزيع', done: true, sortOrder: 2 },
    ],
  },
  {
    id: 'proj-3',
    title: 'مشروع الأضاحي',
    description: 'ذبح وتوزيع الأضاحي على الأسر المستحقة في عيد الأضحى',
    status: 'قادم',
    category: 'موسمي',
    timeline: 'ذو الحجة 2026',
    targetAmount: 300000,
    raisedAmount: 50000,
    supporters: 40,
    published: true,
    stages: [
      { label: 'فتح باب التبرعات', done: true, sortOrder: 0 },
      { label: 'شراء الأضاحي', done: false, sortOrder: 1 },
      { label: 'الذبح والتوزيع', done: false, sortOrder: 2 },
    ],
  },
];

export async function seedProjects(prisma: PrismaClient) {
  console.log('  Seeding projects...');

  for (const p of PROJECTS) {
    const { stages, ...projectData } = p;

    await prisma.project.upsert({
      where: { id: p.id },
      update: {},
      create: projectData,
    });

    for (const stage of stages) {
      await prisma.projectStage
        .create({
          data: { projectId: p.id, ...stage },
        })
        .catch(() => {});
    }
  }

  console.log(`  ✓ ${PROJECTS.length} projects with stages`);
}
