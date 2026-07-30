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
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  CreateCategorySchema,
} from './dto/create-category.dto';
import {
  UpdateCategoryDto,
  UpdateCategorySchema,
} from './dto/update-category.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@Controller('admin/categories')
@UseInterceptors(ActivityLogInterceptor)
export class CategoriesAdminController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'List categories', description: 'Requires services:read.' })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiPaginationQuery()
  @Get()
  @RequirePermission('services', 'read')
  findAll(
    @Query('parentId') parentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.categoriesService.findAll({
      parentId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
    });
  }

  @ApiOperation({ summary: 'Create a category', description: 'Requires services:write.' })
  @ApiZodBody(CreateCategorySchema)
  @Post()
  @RequirePermission('services', 'write')
  @UsePipes(new ZodValidationPipe(CreateCategorySchema))
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a category', description: 'Requires services:write.' })
  @ApiZodBody(UpdateCategorySchema)
  @Patch(':id')
  @RequirePermission('services', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Activate or deactivate a category', description: 'Toggles. Inactive categories are hidden from the public list. Requires services:write.' })
  @Patch(':id/active')
  @RequirePermission('services', 'write')
  toggleActive(@Param('id') id: string) {
    return this.categoriesService.toggleActive(id);
  }

  @ApiOperation({ summary: 'Delete a category', description: 'Requires services:write.' })
  @Delete(':id')
  @RequirePermission('services', 'write')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
