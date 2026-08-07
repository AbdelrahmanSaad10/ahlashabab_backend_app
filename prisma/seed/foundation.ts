import { PrismaClient } from '@prisma/client';
import { preserve } from './seed-mode';

const FOUNDATION_STATS = [
  { key: 'beneficiaries', value: '1.2M+', label: 'مستفيد', icon: 'users', sortOrder: 0 },
  { key: 'volunteers', value: '+10,000', label: 'متطوع', icon: 'heart', sortOrder: 1 },
  { key: 'initiatives', value: '+650', label: 'مبادرة', icon: 'star', sortOrder: 2 },
  { key: 'governorates', value: '12', label: 'محافظة', icon: 'map', sortOrder: 3 },
  { key: 'yearsOfService', value: '+12', label: 'سنة خدمة', icon: 'clock', sortOrder: 4 },
];

const MILESTONES = [
  { year: 2013, title: 'تأسيس الجمعية', description: 'بدأت الجمعية كمبادرة شبابية', sortOrder: 0 },
  { year: 2015, title: 'التوسع في القاهرة', description: 'توسعت أنشطة الجمعية لتشمل محافظة القاهرة الكبرى', sortOrder: 1 },
  { year: 2017, title: 'الوصول لـ 5 محافظات', description: 'امتد نشاط الجمعية ليشمل 5 محافظات', sortOrder: 2 },
  { year: 2019, title: 'مليون مستفيد', description: 'تجاوز عدد المستفيدين المليون مستفيد', sortOrder: 3 },
  { year: 2021, title: 'إطلاق برامج التمكين', description: 'بدء برامج التدريب والتأهيل المهني', sortOrder: 4 },
  { year: 2023, title: 'التحول الرقمي', description: 'إطلاق التطبيق الإلكتروني والمنصة الرقمية', sortOrder: 5 },
  { year: 2025, title: '12 محافظة', description: 'الوصول لـ 12 محافظة ونحن في توسع مستمر', sortOrder: 6 },
];

const VALUES = [
  { title: 'الشفافية', description: 'نلتزم بالشفافية الكاملة في جميع أعمالنا', icon: 'eye', sortOrder: 0 },
  { title: 'التميز', description: 'نسعى للتميز في تقديم خدماتنا', icon: 'award', sortOrder: 1 },
  { title: 'العمل الجماعي', description: 'نؤمن بقوة العمل الجماعي والتعاون', icon: 'users', sortOrder: 2 },
  { title: 'الابتكار', description: 'نبتكر حلولاً جديدة لمواجهة التحديات', icon: 'lightbulb', sortOrder: 3 },
];

const INITIATIVES = [
  { title: 'إفطار صائم', description: 'توزيع وجبات الإفطار في رمضان', icon: 'moon', sortOrder: 0 },
  { title: 'كسوة الشتاء', description: 'توفير ملابس شتوية للأسر المحتاجة', icon: 'cloud', sortOrder: 1 },
  { title: 'كفالة الأيتام', description: 'رعاية وكفالة الأطفال الأيتام', icon: 'heart', sortOrder: 2 },
  { title: 'القوافل الطبية', description: 'تنظيم قوافل طبية مجانية', icon: 'plus', sortOrder: 3 },
  { title: 'التمكين المهني', description: 'تدريب وتأهيل الشباب مهنياً', icon: 'tool', sortOrder: 4 },
];

const CONSULTANTS = [
  {
    id: 'consultant-1',
    name: 'د. عبد الرحمن السيد',
    specialization: 'استشاري تنمية بشرية',
    bio: 'خبير في التنمية البشرية والتطوير المؤسسي',
    sortOrder: 0,
  },
  {
    id: 'consultant-2',
    name: 'أ. نورهان محمد',
    specialization: 'مستشار أسري',
    bio: 'متخصصة في الإرشاد الأسري وحل النزاعات',
    sortOrder: 1,
  },
  {
    id: 'consultant-3',
    name: 'د. كريم حسين',
    specialization: 'مستشار تعليمي',
    bio: 'خبير في التوجيه التعليمي والمهني للشباب',
    sortOrder: 2,
  },
];

export async function seedFoundation(prisma: PrismaClient) {
  console.log('  Seeding foundation content...');

  // Stats
  for (const stat of FOUNDATION_STATS) {
    await prisma.foundationStat.upsert({
      where: { key: stat.key },
      update: preserve({ value: stat.value, label: stat.label, icon: stat.icon, sortOrder: stat.sortOrder }),
      create: stat,
    });
  }

  // Milestones
  for (let i = 0; i < MILESTONES.length; i++) {
    await prisma.milestone.upsert({
      where: { id: `milestone-${i}` },
      update: {},
      create: { id: `milestone-${i}`, ...MILESTONES[i] },
    });
  }

  // Values
  for (let i = 0; i < VALUES.length; i++) {
    await prisma.foundationValue.upsert({
      where: { id: `value-${i}` },
      update: {},
      create: { id: `value-${i}`, ...VALUES[i] },
    });
  }

  // Initiatives
  for (let i = 0; i < INITIATIVES.length; i++) {
    await prisma.initiative.upsert({
      where: { id: `initiative-${i}` },
      update: {},
      create: { id: `initiative-${i}`, ...INITIATIVES[i] },
    });
  }

  // Consultants
  for (const c of CONSULTANTS) {
    await prisma.consultant.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }

  console.log(
    `  ✓ ${FOUNDATION_STATS.length} stats, ${MILESTONES.length} milestones, ${VALUES.length} values, ${INITIATIVES.length} initiatives, ${CONSULTANTS.length} consultants`,
  );
}
