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

@Controller('admin/services')
@UseInterceptors(ActivityLogInterceptor)
export class ServicesAdminController {
  constructor(private readonly servicesService: ServicesService) {}

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

  @Post()
  @RequirePermission('services', 'write')
  @UsePipes(new ZodValidationPipe(CreateServiceSchema))
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('services', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateServiceSchema)) dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('services', 'write')
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
