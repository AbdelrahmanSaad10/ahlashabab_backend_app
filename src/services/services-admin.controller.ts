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
import { ServicesService } from './services.service';
import {
  CreateServiceDto,
  CreateServiceSchema,
} from './dto/create-service.dto';
import {
  UpdateServiceDto,
  UpdateServiceSchema,
} from './dto/update-service.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Services')
@ApiBearerAuth('access-token')
@Controller('admin/services')
@UseInterceptors(ActivityLogInterceptor)
export class ServicesAdminController {
  constructor(private readonly servicesService: ServicesService) {}

  @ApiOperation({ summary: 'List services', description: 'Requires services:read.' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiPaginationQuery()
  @Get()
  @RequirePermission('services', 'read')
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.servicesService.findAll({
      categoryId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
    });
  }

  @ApiOperation({ summary: 'Create a service', description: 'Requires services:write.' })
  @ApiZodBody(CreateServiceSchema)
  @Post()
  @RequirePermission('services', 'write')
  @UsePipes(new ZodValidationPipe(CreateServiceSchema))
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a service', description: 'Requires services:write.' })
  @ApiZodBody(UpdateServiceSchema)
  @Patch(':id')
  @RequirePermission('services', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateServiceSchema)) dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a service', description: 'Requires services:write.' })
  @Delete(':id')
  @RequirePermission('services', 'write')
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
