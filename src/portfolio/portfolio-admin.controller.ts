import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PortfolioService } from './portfolio.service';
import { CreateCaseDto, CreateCaseSchema } from './dto/create-case.dto';
import {
  CreateProjectDto,
  CreateProjectSchema,
} from './dto/create-project.dto';
import {
  PortfolioFiltersDto,
  PortfolioFiltersSchema,
} from './dto/portfolio-filters.dto';
import {
  CreatePortfolioItemDto,
  CreatePortfolioItemSchema,
} from './dto/create-portfolio-item.dto';

@Controller('admin/portfolio')
@UseInterceptors(ActivityLogInterceptor)
export class PortfolioAdminController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ── Cases ──────────────────────────────────────

  @Get('cases')
  @RequirePermission('portfolio', 'read')
  findAllCases(
    @Query('tag') tag?: string,
    @Query('published') published?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portfolioService.findAllCases({
      tag,
      published: published !== undefined ? published === 'true' : undefined,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('cases/:id')
  @RequirePermission('portfolio', 'read')
  findCaseById(@Param('id') id: string) {
    return this.portfolioService.findCaseById(id);
  }

  @Post('cases')
  @RequirePermission('portfolio', 'write')
  createCase(@Body(new ZodValidationPipe(CreateCaseSchema)) dto: CreateCaseDto) {
    return this.portfolioService.createCase(dto);
  }

  @Patch('cases/:id')
  @RequirePermission('portfolio', 'write')
  updateCase(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateCaseSchema.partial())) dto: Partial<CreateCaseDto>,
  ) {
    return this.portfolioService.updateCase(id, dto);
  }

  @Delete('cases/:id')
  @RequirePermission('portfolio', 'write')
  deleteCase(@Param('id') id: string) {
    return this.portfolioService.deleteCase(id);
  }

  @Post('cases/:id/updates')
  @RequirePermission('portfolio', 'write')
  addCaseUpdate(
    @Param('id') caseId: string,
    @Body() body: { text: string; kind?: string },
  ) {
    return this.portfolioService.addCaseUpdate(caseId, body.text, body.kind);
  }

  // ── Projects ───────────────────────────────────

  @Get('projects')
  @RequirePermission('portfolio', 'read')
  findAllProjects(
    @Query('category') category?: string,
    @Query('published') published?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.portfolioService.findAllProjects({
      category,
      published: published !== undefined ? published === 'true' : undefined,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('projects/:id')
  @RequirePermission('portfolio', 'read')
  findProjectById(@Param('id') id: string) {
    return this.portfolioService.findProjectById(id);
  }

  @Post('projects')
  @RequirePermission('portfolio', 'write')
  createProject(@Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto) {
    return this.portfolioService.createProject(dto);
  }

  @Patch('projects/:id')
  @RequirePermission('portfolio', 'write')
  updateProject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateProjectSchema.partial()))
    dto: Partial<CreateProjectDto>,
  ) {
    return this.portfolioService.updateProject(id, dto);
  }

  @Delete('projects/:id')
  @RequirePermission('portfolio', 'write')
  deleteProject(@Param('id') id: string) {
    return this.portfolioService.deleteProject(id);
  }

  @Post('projects/:id/stages')
  @RequirePermission('portfolio', 'write')
  addProjectStage(
    @Param('id') projectId: string,
    @Body() dto: { label: string; done?: boolean; sortOrder?: number },
  ) {
    return this.portfolioService.addProjectStage(projectId, dto);
  }

  @Post('projects/:id/updates')
  @RequirePermission('portfolio', 'write')
  addProjectUpdate(
    @Param('id') projectId: string,
    @Body() body: { text: string; kind?: string },
  ) {
    return this.portfolioService.addProjectUpdate(
      projectId,
      body.text,
      body.kind,
    );
  }

  // ── Portfolio Items ────────────────────────────

  @Get()
  @RequirePermission('portfolio', 'read')
  findAll(
    @Query(new ZodValidationPipe(PortfolioFiltersSchema))
    filters: PortfolioFiltersDto,
  ) {
    return this.portfolioService.findAll(filters);
  }

  @Post()
  @RequirePermission('portfolio', 'write')
  create(@Body(new ZodValidationPipe(CreatePortfolioItemSchema)) dto: CreatePortfolioItemDto) {
    return this.portfolioService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('portfolio', 'write')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(CreatePortfolioItemSchema.partial())) dto: Partial<CreatePortfolioItemDto>) {
    return this.portfolioService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('portfolio', 'write')
  remove(@Param('id') id: string) {
    return this.portfolioService.delete(id);
  }

  @Patch(':id/publish')
  @RequirePermission('portfolio', 'write')
  togglePublish(@Param('id') id: string) {
    return this.portfolioService.togglePublish(id);
  }

  // ── Media Upload ───────────────────────────────

  @Post('uploads')
  @RequirePermission('portfolio', 'write')
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(@UploadedFile() file: Express.Multer.File) {
    return {
      url: file?.path || file?.filename,
      originalName: file?.originalname,
      size: file?.size,
    };
  }
}
