import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PortfolioService } from './portfolio.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Portfolio')
@Controller()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ── Projects ───────────────────────────────────

  @ApiOperation({ summary: 'List published projects' })
  @ApiQuery({ name: 'category', required: false })
  @ApiPaginationQuery()
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

  @ApiOperation({ summary: 'Get one project', description: 'Includes its stages, ordered.' })
  @Public()
  @Get('projects/:id')
  findProjectById(@Param('id') id: string) {
    return this.portfolioService.findProjectById(id);
  }

  // ── Cases ──────────────────────────────────────

  @ApiOperation({ summary: 'List published humanitarian cases' })
  @ApiQuery({ name: 'tag', required: false })
  @ApiPaginationQuery()
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

  @ApiOperation({ summary: 'Get one case' })
  @Public()
  @Get('cases/:id')
  findCaseById(@Param('id') id: string) {
    return this.portfolioService.findCaseById(id);
  }

  // ── Consultants ────────────────────────────────

  @ApiOperation({ summary: 'List consultants', description: 'Providers surfaced to the app for consultation booking.' })
  @Public()
  @Get('consultants')
  getConsultants() {
    return this.portfolioService.getConsultants();
  }
}
