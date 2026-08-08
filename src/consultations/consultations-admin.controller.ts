import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ConsultationsService } from './consultations.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';
import {
  UpdateConsultationStatusDto,
  UpdateConsultationStatusSchema,
} from './dto/update-consultation-status.dto';
import {
  ScheduleConsultationDto,
  ScheduleConsultationSchema,
} from './dto/schedule-consultation.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Consultations')
@ApiBearerAuth('access-token')
@Controller('admin/consultations')
@UseInterceptors(ActivityLogInterceptor)
export class ConsultationsAdminController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @ApiOperation({ summary: 'List consultation requests', description: 'Paginated. Requires portfolio:read.' })
  @ApiQuery({ name: 'type', required: false, description: 'Consultation type key' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search' })
  @Get()
  @RequirePermission('portfolio', 'read')
  findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.consultationsService.findAll({
      type,
      status,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @ApiOperation({
    summary: 'Update a consultation request status',
    description:
      'One of جديد · قيد المراجعة · مكتمل · ملغي. **`تم تحديد موعد` is refused here** — scheduling '
      + 'means a provider, a date and a time, so it goes through PATCH :id/schedule. Requires '
      + 'portfolio:write.',
  })
  @ApiZodBody(UpdateConsultationStatusSchema)
  @Patch(':id/status')
  @RequirePermission('portfolio', 'write')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateConsultationStatusSchema)) dto: UpdateConsultationStatusDto,
  ) {
    return this.consultationsService.updateStatus(id, dto.status);
  }

  @ApiOperation({
    summary: 'Schedule a consultation with a provider',
    description:
      'Assigns the request to a provider at a date and time and sets the status to تم تحديد موعد. '
      + 'This existed in the service and no route exposed it, so a request could be marked scheduled '
      + 'with no provider, date or time recorded against it. Requires portfolio:write.',
  })
  @ApiZodBody(ScheduleConsultationSchema)
  @Patch(':id/schedule')
  @RequirePermission('portfolio', 'write')
  schedule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ScheduleConsultationSchema)) dto: ScheduleConsultationDto,
  ) {
    return this.consultationsService.schedule(id, dto);
  }
}
