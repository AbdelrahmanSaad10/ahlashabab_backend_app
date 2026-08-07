import { PrismaClient } from '@prisma/client';
import { seedGovernorates, seedWorkAreas } from './governorates';
import { seedRoles } from './roles';
import { seedAdminUsers } from './admin-users';
import { seedCategories } from './categories';
import { seedProviders } from './providers';
import { seedServices } from './services';
import { seedCases } from './cases';
import { seedProjects } from './projects';
import { seedArticles } from './articles';
import { seedFaqs } from './faqs';
import { seedFoundation } from './foundation';
import { seedCmsState } from './cms-state';
import { logSeedMode } from './seed-mode';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');
  logSeedMode();

  // Reference data (no FK deps)
  await seedGovernorates(prisma);
  await seedWorkAreas(prisma);

  // Auth & roles
  await seedRoles(prisma);
  await seedAdminUsers(prisma);

  // Catalog
  await seedCategories(prisma);
  await seedProviders(prisma);
  await seedServices(prisma);

  // Foundation content
  await seedFoundation(prisma);

  // Portfolio
  await seedCases(prisma);
  await seedProjects(prisma);

  // Content
  await seedArticles(prisma);
  await seedFaqs(prisma);

  // CMS
  await seedCmsState(prisma);

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
