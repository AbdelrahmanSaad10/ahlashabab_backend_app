import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PortfolioService } from './portfolio.service';

@Controller()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ── Projects ───────────────────────────────────

  @Public()
  @Get('projects')
  findAllProjects(
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portfolioService.findAllProjects({
      published: true,
      category,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Public()
  @Get('projects/:id')
  findProjectById(@Param('id') id: string) {
    return this.portfolioService.findProjectById(id);
  }

  // ── Cases ──────────────────────────────────────

  @Public()
  @Get('cases')
  findAllCases(
    @Query('tag') tag?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portfolioService.findAllCases({
      published: true,
      tag,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Public()
  @Get('cases/:id')
  findCaseById(@Param('id') id: string) {
    return this.portfolioService.findCaseById(id);
  }

  // ── Consultants ────────────────────────────────

  @Public()
  @Get('consultants')
  getConsultants() {
    return this.portfolioService.getConsultants();
  }
}
