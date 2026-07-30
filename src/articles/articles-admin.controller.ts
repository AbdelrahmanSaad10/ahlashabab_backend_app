import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ArticlesService } from './articles.service';
import {
  CreateArticleDto,
  CreateArticleSchema,
} from './dto/create-article.dto';
import {
  UpdateArticleDto,
  UpdateArticleSchema,
} from './dto/update-article.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Articles')
@ApiBearerAuth('access-token')
@Controller('admin/articles')
@UseInterceptors(ActivityLogInterceptor)
export class ArticlesAdminController {
  constructor(private readonly articlesService: ArticlesService) {}

  @ApiOperation({ summary: 'List articles (drafts included)', description: 'Requires portfolio:read.' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'published', required: false, schema: { type: 'boolean' }, description: 'Omit for both' })
  @ApiPaginationQuery()
  @Get()
  @RequirePermission('portfolio', 'read')
  findAll(
    @Query('category') category?: string,
    @Query('published') published?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.articlesService.findAll({
      category,
      published: published !== undefined ? published === 'true' : undefined,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @ApiOperation({ summary: 'Create an article', description: 'Requires portfolio:write.' })
  @ApiZodBody(CreateArticleSchema)
  @Post()
  @RequirePermission('portfolio', 'write')
  @UsePipes(new ZodValidationPipe(CreateArticleSchema))
  create(@Body() dto: CreateArticleDto) {
    return this.articlesService.create(dto);
  }

  @ApiOperation({ summary: 'Update an article', description: 'Requires portfolio:write.' })
  @ApiZodBody(UpdateArticleSchema)
  @Patch(':id')
  @RequirePermission('portfolio', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateArticleSchema)) dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Publish or unpublish an article', description: 'Toggles. Requires portfolio:write.' })
  @Patch(':id/publish')
  @RequirePermission('portfolio', 'write')
  togglePublish(@Param('id') id: string) {
    return this.articlesService.togglePublish(id);
  }

  @ApiOperation({ summary: 'Delete an article', description: 'Requires portfolio:write.' })
  @Delete(':id')
  @RequirePermission('portfolio', 'write')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}
