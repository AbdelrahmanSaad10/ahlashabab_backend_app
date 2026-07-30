import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PortfolioService } from './portfolio.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Foundation')
@Controller()
export class FoundationController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @ApiOperation({
    summary: 'Home screen aggregate',
    description:
      'One call for the whole home screen: `stats`, `workAreas`, `quickServices` (top 6 root '
      + 'categories), `featuredCase` and `featuredProject` (each the newest published one).',
  })
  @Public()
  @Get('home')
  async getHomePage() {
    const [stats, workAreas, quickServices, featuredCase, featuredProject] =
      await Promise.all([
        this.portfolioService.getFoundationStats(),
        this.portfolioService['prisma'].workArea.findMany({
          where: { active: true },
          include: { governorate: true },
          orderBy: { sortOrder: 'asc' },
        }),
        this.portfolioService['prisma'].serviceCategory.findMany({
          where: { active: true, parentId: null },
          orderBy: { sortOrder: 'asc' },
          take: 6,
        }),
        this.portfolioService['prisma'].case.findFirst({
          where: { published: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.portfolioService['prisma'].project.findFirst({
          where: { published: true },
          orderBy: { createdAt: 'desc' },
          include: { stages: { orderBy: { sortOrder: 'asc' } } },
        }),
      ]);

    return {
      stats,
      workAreas,
      quickServices,
      featuredCase,
      featuredProject,
    };
  }

  @ApiOperation({
    summary: 'About-the-foundation aggregate',
    description: 'Returns `stats`, `milestones`, `values`, `initiatives` and `workAreas` in one call.',
  })
  @Public()
  @Get('foundation')
  async getFoundationPage() {
    const [stats, milestones, values, initiatives, workAreas] =
      await Promise.all([
        this.portfolioService.getFoundationStats(),
        this.portfolioService.getMilestones(),
        this.portfolioService.getValues(),
        this.portfolioService.getInitiatives(),
        this.portfolioService['prisma'].workArea.findMany({
          where: { active: true },
          include: { governorate: true },
          orderBy: { sortOrder: 'asc' },
        }),
      ]);

    return {
      stats,
      milestones,
      values,
      initiatives,
      workAreas,
    };
  }
}
