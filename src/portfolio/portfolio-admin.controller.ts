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
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodBody, ApiZodQuery } from '../common/swagger/api-zod-body.decorator';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Portfolio Admin')
@ApiBearerAuth('access-token')
@Controller('admin/portfolio')
@UseInterceptors(ActivityLogInterceptor)
export class PortfolioAdminController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ── Cases ──────────────────────────────────────

  @ApiOperation({ summary: 'List cases (drafts included)', description: 'Requires portfolio:read.' })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'published', required: false, schema: { type: 'boolean' }, description: 'Omit for both drafts and published' })
  @ApiPaginationQuery()
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

  @ApiOperation({ summary: 'Get one case', description: 'Requires portfolio:read.' })
  @Get('cases/:id')
  @RequirePermission('portfolio', 'read')
  findCaseById(@Param('id') id: string) {
    return this.portfolioService.findCaseById(id);
  }

  @ApiOperation({ summary: 'Create a case', description: 'Requires portfolio:write.' })
  @ApiZodBody(CreateCaseSchema)
  @Post('cases')
  @RequirePermission('portfolio', 'write')
  createCase(@Body(new ZodValidationPipe(CreateCaseSchema)) dto: CreateCaseDto) {
    return this.portfolioService.createCase(dto);
  }

  @ApiOperation({ summary: 'Update a case', description: 'Partial — every create field is optional. Requires portfolio:write.' })
  @ApiZodBody(CreateCaseSchema.partial())
  @Patch('cases/:id')
  @RequirePermission('portfolio', 'write')
  updateCase(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateCaseSchema.partial())) dto: Partial<CreateCaseDto>,
  ) {
    return this.portfolioService.updateCase(id, dto);
  }

  @ApiOperation({ summary: 'Delete a case', description: 'Requires portfolio:write.' })
  @Delete('cases/:id')
  @RequirePermission('portfolio', 'write')
  deleteCase(@Param('id') id: string) {
    return this.portfolioService.deleteCase(id);
  }

  @ApiOperation({ summary: 'Append a progress update to a case', description: 'Shown on the case timeline in the app. Requires portfolio:write.' })
  @ApiBody({ schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, kind: { type: 'string' } } } })
  @Post('cases/:id/updates')
  @RequirePermission('portfolio', 'write')
  addCaseUpdate(
    @Param('id') caseId: string,
    @Body() body: { text: string; kind?: string },
  ) {
    return this.portfolioService.addCaseUpdate(caseId, body.text, body.kind);
  }

  // ── Projects ───────────────────────────────────

  @ApiOperation({ summary: 'List projects (drafts included)', description: 'Requires portfolio:read.' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'published', required: false, schema: { type: 'boolean' }, description: 'Omit for both drafts and published' })
  @ApiPaginationQuery()
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

  @ApiOperation({ summary: 'Get one project', description: 'Includes its stages, ordered. Requires portfolio:read.' })
  @Get('projects/:id')
  @RequirePermission('portfolio', 'read')
  findProjectById(@Param('id') id: string) {
    return this.portfolioService.findProjectById(id);
  }

  @ApiOperation({ summary: 'Create a project', description: 'Requires portfolio:write.' })
  @ApiZodBody(CreateProjectSchema)
  @Post('projects')
  @RequirePermission('portfolio', 'write')
  createProject(@Body(new ZodValidationPipe(CreateProjectSchema)) dto: CreateProjectDto) {
    return this.portfolioService.createProject(dto);
  }

  @ApiOperation({ summary: 'Update a project', description: 'Partial — every create field is optional. Requires portfolio:write.' })
  @ApiZodBody(CreateProjectSchema.partial())
  @Patch('projects/:id')
  @RequirePermission('portfolio', 'write')
  updateProject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateProjectSchema.partial()))
    dto: Partial<CreateProjectDto>,
  ) {
    return this.portfolioService.updateProject(id, dto);
  }

  @ApiOperation({ summary: 'Delete a project', description: 'Requires portfolio:write.' })
  @Delete('projects/:id')
  @RequirePermission('portfolio', 'write')
  deleteProject(@Param('id') id: string) {
    return this.portfolioService.deleteProject(id);
  }

  @ApiOperation({ summary: 'Add a stage to a project', description: 'Stages render as the project progress checklist, ordered by sortOrder. Requires portfolio:write.' })
  @ApiBody({ schema: { type: 'object', required: ['label'], properties: { label: { type: 'string' }, done: { type: 'boolean' }, sortOrder: { type: 'integer' } } } })
  @Post('projects/:id/stages')
  @RequirePermission('portfolio', 'write')
  addProjectStage(
    @Param('id') projectId: string,
    @Body() dto: { label: string; done?: boolean; sortOrder?: number },
  ) {
    return this.portfolioService.addProjectStage(projectId, dto);
  }

  @ApiOperation({ summary: 'Append a progress update to a project', description: 'Requires portfolio:write.' })
  @ApiBody({ schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, kind: { type: 'string' } } } })
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

  @ApiOperation({ summary: 'List portfolio items', description: 'Generic view across portfolio item types. The cases/ and projects/ routes above are the typed equivalents. Requires portfolio:read.' })
  @ApiZodQuery(PortfolioFiltersSchema)
  @Get()
  @RequirePermission('portfolio', 'read')
  findAll(
    @Query(new ZodValidationPipe(PortfolioFiltersSchema))
    filters: PortfolioFiltersDto,
  ) {
    return this.portfolioService.findAll(filters);
  }

  @ApiOperation({ summary: 'Create a portfolio item', description: 'Generic. Prefer POST cases or POST projects when the type is known. Requires portfolio:write.' })
  @ApiZodBody(CreatePortfolioItemSchema)
  @Post()
  @RequirePermission('portfolio', 'write')
  create(@Body(new ZodValidationPipe(CreatePortfolioItemSchema)) dto: CreatePortfolioItemDto) {
    return this.portfolioService.create(dto);
  }

  @ApiOperation({ summary: 'Update a portfolio item', description: 'Generic and partial. Requires portfolio:write.' })
  @ApiZodBody(CreatePortfolioItemSchema.partial())
  @Patch(':id')
  @RequirePermission('portfolio', 'write')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(CreatePortfolioItemSchema.partial())) dto: Partial<CreatePortfolioItemDto>) {
    return this.portfolioService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a portfolio item', description: 'Requires portfolio:write.' })
  @Delete(':id')
  @RequirePermission('portfolio', 'write')
  remove(@Param('id') id: string) {
    return this.portfolioService.delete(id);
  }

  @ApiOperation({ summary: 'Publish or unpublish a portfolio item', description: 'Toggles. Only published items reach the public routes. Requires portfolio:write.' })
  @Patch(':id/publish')
  @RequirePermission('portfolio', 'write')
  togglePublish(@Param('id') id: string) {
    return this.portfolioService.togglePublish(id);
  }

  // ── Media Upload ───────────────────────────────

  @ApiOperation({ summary: 'Upload portfolio media', description: 'Multipart. Requires portfolio:write.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
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
