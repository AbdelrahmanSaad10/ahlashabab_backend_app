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
import { ProvidersService } from './providers.service';
import {
  CreateProviderDto,
  CreateProviderSchema,
} from './dto/create-provider.dto';
import {
  UpdateScheduleDto,
  UpdateScheduleSchema,
} from './dto/update-schedule.dto';
import {
  UnavailableDateDto,
  UnavailableDateSchema,
} from './dto/unavailable-date.dto';

@Controller('admin/providers')
@UseInterceptors(ActivityLogInterceptor)
export class ProvidersAdminController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @RequirePermission('services', 'read')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.providersService.findAllAdmin({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
    });
  }

  @Get(':id')
  @RequirePermission('services', 'read')
  findOne(@Param('id') id: string) {
    return this.providersService.findOne(id);
  }

  @Post()
  @RequirePermission('services', 'write')
  @UsePipes(new ZodValidationPipe(CreateProviderSchema))
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('services', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateProviderSchema.partial())) dto: Partial<CreateProviderDto>,
  ) {
    return this.providersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('services', 'write')
  remove(@Param('id') id: string) {
    return this.providersService.remove(id);
  }

  @Patch(':id/schedule')
  @RequirePermission('services', 'write')
  setSchedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateScheduleSchema)) dto: UpdateScheduleDto,
  ) {
    return this.providersService.setSchedule(id, dto);
  }

  @Post(':id/unavailable-dates')
  @RequirePermission('services', 'write')
  addUnavailableDate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UnavailableDateSchema)) dto: UnavailableDateDto,
  ) {
    return this.providersService.addUnavailableDate(id, dto.date);
  }

  @Delete(':id/unavailable-dates/:date')
  @RequirePermission('services', 'write')
  removeUnavailableDate(
    @Param('id') id: string,
    @Param('date') date: string,
  ) {
    return this.providersService.removeUnavailableDate(id, date);
  }

  @Patch(':id/accepting-bookings')
  @RequirePermission('services', 'write')
  toggleAcceptingBookings(@Param('id') id: string) {
    return this.providersService.toggleAcceptingBookings(id);
  }

  @Post(':id/services/:serviceId')
  @RequirePermission('services', 'write')
  assignService(
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.providersService.assignService(id, serviceId);
  }
}
