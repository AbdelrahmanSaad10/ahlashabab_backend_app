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

@Controller('admin/articles')
@UseInterceptors(ActivityLogInterceptor)
export class ArticlesAdminController {
  constructor(private readonly articlesService: ArticlesService) {}

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

  @Post()
  @RequirePermission('portfolio', 'write')
  @UsePipes(new ZodValidationPipe(CreateArticleSchema))
  create(@Body() dto: CreateArticleDto) {
    return this.articlesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('portfolio', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateArticleSchema)) dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(id, dto);
  }

  @Patch(':id/publish')
  @RequirePermission('portfolio', 'write')
  togglePublish(@Param('id') id: string) {
    return this.articlesService.togglePublish(id);
  }

  @Delete(':id')
  @RequirePermission('portfolio', 'write')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}
