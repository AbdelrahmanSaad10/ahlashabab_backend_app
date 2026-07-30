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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Providers')
@ApiBearerAuth('access-token')
@Controller('admin/providers')
@UseInterceptors(ActivityLogInterceptor)
export class ProvidersAdminController {
  constructor(private readonly providersService: ProvidersService) {}

  @ApiOperation({ summary: 'List providers', description: 'Requires services:read.' })
  @ApiPaginationQuery()
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

  @ApiOperation({ summary: 'Get one provider', description: 'Requires services:read.' })
  @Get(':id')
  @RequirePermission('services', 'read')
  findOne(@Param('id') id: string) {
    return this.providersService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a provider', description: 'Requires services:write.' })
  @ApiZodBody(CreateProviderSchema)
  @Post()
  @RequirePermission('services', 'write')
  @UsePipes(new ZodValidationPipe(CreateProviderSchema))
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  @ApiOperation({ summary: 'Update a provider', description: 'Partial — every field of the create schema is optional here. Requires services:write.' })
  @ApiZodBody(CreateProviderSchema.partial())
  @Patch(':id')
  @RequirePermission('services', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateProviderSchema.partial())) dto: Partial<CreateProviderDto>,
  ) {
    return this.providersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a provider', description: 'Requires services:write.' })
  @Delete(':id')
  @RequirePermission('services', 'write')
  remove(@Param('id') id: string) {
    return this.providersService.remove(id);
  }

  @ApiOperation({ summary: "Replace a provider's weekly schedule", description: 'This is what drives GET /services/{id}/availability. Requires services:write.' })
  @ApiZodBody(UpdateScheduleSchema)
  @Patch(':id/schedule')
  @RequirePermission('services', 'write')
  setSchedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateScheduleSchema)) dto: UpdateScheduleDto,
  ) {
    return this.providersService.setSchedule(id, dto);
  }

  @ApiOperation({ summary: 'Block a date for a provider', description: 'Blocked dates are removed from availability. Requires services:write.' })
  @ApiZodBody(UnavailableDateSchema)
  @Post(':id/unavailable-dates')
  @RequirePermission('services', 'write')
  addUnavailableDate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UnavailableDateSchema)) dto: UnavailableDateDto,
  ) {
    return this.providersService.addUnavailableDate(id, dto.date);
  }

  @ApiOperation({ summary: 'Unblock a date for a provider', description: 'Requires services:write.' })
  @ApiParam({ name: 'date', description: 'The blocked date, YYYY-MM-DD', schema: { type: 'string', format: 'date' } })
  @Delete(':id/unavailable-dates/:date')
  @RequirePermission('services', 'write')
  removeUnavailableDate(
    @Param('id') id: string,
    @Param('date') date: string,
  ) {
    return this.providersService.removeUnavailableDate(id, date);
  }

  @ApiOperation({ summary: 'Toggle whether a provider accepts bookings', description: 'Toggles. Requires services:write.' })
  @Patch(':id/accepting-bookings')
  @RequirePermission('services', 'write')
  toggleAcceptingBookings(@Param('id') id: string) {
    return this.providersService.toggleAcceptingBookings(id);
  }

  @ApiOperation({ summary: 'Assign a service to a provider', description: 'Requires services:write.' })
  @Post(':id/services/:serviceId')
  @RequirePermission('services', 'write')
  assignService(
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.providersService.assignService(id, serviceId);
  }
}
