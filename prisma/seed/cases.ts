import { PrismaClient } from '@prisma/client';

const CASES = [
  {
    id: 'case-1',
    code: 'C-001',
    title: 'أسرة بحاجة لسداد إيجار',
    location: 'القاهرة - المعادي',
    summary: 'أسرة مكونة من 5 أفراد تعاني من صعوبة في سداد الإيجار الشهري بسبب فقدان العائل لعمله',
    need: 'سداد إيجار 3 أشهر',
    tag: 'عاجلة',
    verified: true,
    targetAmount: 9000,
    raisedAmount: 5400,
    supporters: 12,
    sponsorable: true,
    monthlyAmount: 3000,
    sponsorshipDuration: '6 أشهر',
    sponsorshipStatus: 'متاحة للكفالة',
    published: true,
  },
  {
    id: 'case-2',
    code: 'C-002',
    title: 'طفل بحاجة لعملية جراحية',
    location: 'الجيزة - فيصل',
    summary: 'طفل يبلغ من العمر 7 سنوات يحتاج لعملية جراحية في القلب',
    need: 'تكاليف العملية والعلاج',
    tag: 'عاجلة',
    verified: true,
    targetAmount: 50000,
    raisedAmount: 35000,
    supporters: 45,
    sponsorable: false,
    sponsorshipStatus: null,
    published: true,
  },
  {
    id: 'case-3',
    code: 'C-003',
    title: 'أسرة أيتام بحاجة لكفالة شهرية',
    location: 'الإسكندرية',
    summary: 'أسرة فقدت العائل وتضم 3 أطفال أيتام في مراحل التعليم الأساسي',
    need: 'كفالة شهرية للأيتام',
    tag: 'كفالة',
    verified: true,
    targetAmount: 36000,
    raisedAmount: 12000,
    supporters: 8,
    sponsorable: true,
    monthlyAmount: 2000,
    sponsorshipDuration: '12 شهر',
    sponsorshipStatus: 'مكفولة جزئياً',
    published: true,
  },
  {
    id: 'case-4',
    code: 'C-004',
    title: 'مساعدة طالب جامعي',
    location: 'المنيا',
    summary: 'طالب متفوق بحاجة لمصاريف الجامعة والكتب الدراسية',
    need: 'مصاريف دراسية',
    tag: 'تعليم',
    verified: true,
    targetAmount: 15000,
    raisedAmount: 15000,
    supporters: 20,
    sponsorable: false,
    sponsorshipStatus: 'مكتملة',
    published: true,
  },
];

const CASE_UPDATES = [
  { caseId: 'case-1', text: 'تم التحقق من الحالة وزيارة الأسرة', kind: 'تحقق' },
  { caseId: 'case-1', text: 'تم سداد إيجار الشهر الأول', kind: 'تحديث' },
  { caseId: 'case-2', text: 'تم حجز موعد العملية', kind: 'تحديث' },
  { caseId: 'case-3', text: 'بدء صرف الكفالة الشهرية', kind: 'تحديث' },
  { caseId: 'case-4', text: 'تم اكتمال المبلغ المطلوب - جزاكم الله خيراً', kind: 'اكتمال' },
];

export async function seedCases(prisma: PrismaClient) {
  console.log('  Seeding cases...');

  for (const c of CASES) {
    await prisma.case.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }

  for (const u of CASE_UPDATES) {
    await prisma.caseUpdate.create({ data: u }).catch(() => {});
  }

  console.log(`  ✓ ${CASES.length} cases with updates`);
}
