import { PrismaClient } from '@prisma/client';

const PROVIDERS = [
  {
    id: 'provider-1',
    name: 'د. أحمد محمود',
    specialization: 'استشاري نفسي',
    bio: 'استشاري الصحة النفسية - خبرة 15 عاماً في الإرشاد النفسي والأسري',
    yearsExperience: 15,
    rating: 4.8,
    reviews: 124,
    schedules: [
      { weekday: 0, startTime: '09:00', endTime: '15:00', slotMinutes: 45 },
      { weekday: 1, startTime: '09:00', endTime: '15:00', slotMinutes: 45 },
      { weekday: 2, startTime: '09:00', endTime: '15:00', slotMinutes: 45 },
      { weekday: 3, startTime: '09:00', endTime: '15:00', slotMinutes: 45 },
      { weekday: 4, startTime: '09:00', endTime: '13:00', slotMinutes: 45 },
    ],
  },
  {
    id: 'provider-2',
    name: 'أ. فاطمة حسن',
    specialization: 'أخصائية اجتماعية',
    bio: 'أخصائية اجتماعية متخصصة في شؤون الأسرة والطفل',
    yearsExperience: 10,
    rating: 4.9,
    reviews: 89,
    schedules: [
      { weekday: 0, startTime: '10:00', endTime: '16:00', slotMinutes: 30 },
      { weekday: 2, startTime: '10:00', endTime: '16:00', slotMinutes: 30 },
      { weekday: 4, startTime: '10:00', endTime: '14:00', slotMinutes: 30 },
    ],
  },
  {
    id: 'provider-3',
    name: 'أ. محمد علي',
    specialization: 'مستشار قانوني',
    bio: 'مستشار قانوني متخصص في الأحوال الشخصية وقضايا الأسرة',
    yearsExperience: 12,
    rating: 4.7,
    reviews: 56,
    schedules: [
      { weekday: 1, startTime: '09:00', endTime: '14:00', slotMinutes: 60 },
      { weekday: 3, startTime: '09:00', endTime: '14:00', slotMinutes: 60 },
    ],
  },
  {
    id: 'provider-4',
    name: 'د. سارة إبراهيم',
    specialization: 'طبيبة عامة',
    bio: 'طبيبة عامة - خبرة في الكشف الطبي والرعاية الصحية الأولية',
    yearsExperience: 8,
    rating: 4.6,
    reviews: 73,
    schedules: [
      { weekday: 0, startTime: '08:00', endTime: '14:00', slotMinutes: 30 },
      { weekday: 1, startTime: '08:00', endTime: '14:00', slotMinutes: 30 },
      { weekday: 2, startTime: '08:00', endTime: '14:00', slotMinutes: 30 },
      { weekday: 3, startTime: '08:00', endTime: '14:00', slotMinutes: 30 },
      { weekday: 4, startTime: '08:00', endTime: '12:00', slotMinutes: 30 },
    ],
  },
];

export async function seedProviders(prisma: PrismaClient) {
  console.log('  Seeding providers...');

  for (const p of PROVIDERS) {
    await prisma.provider.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        specialization: p.specialization,
        bio: p.bio,
        yearsExperience: p.yearsExperience,
        rating: p.rating,
        reviews: p.reviews,
      },
      create: {
        id: p.id,
        name: p.name,
        specialization: p.specialization,
        bio: p.bio,
        yearsExperience: p.yearsExperience,
        rating: p.rating,
        reviews: p.reviews,
      },
    });

    // Seed schedules
    for (const s of p.schedules) {
      await prisma.providerSchedule.upsert({
        where: {
          providerId_weekday: { providerId: p.id, weekday: s.weekday },
        },
        update: {
          startTime: s.startTime,
          endTime: s.endTime,
          slotMinutes: s.slotMinutes,
        },
        create: {
          providerId: p.id,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          slotMinutes: s.slotMinutes,
        },
      });
    }
  }

  console.log(`  ✓ ${PROVIDERS.length} providers with schedules`);
}
