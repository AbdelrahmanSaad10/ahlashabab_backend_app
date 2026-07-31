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
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ConsultationsService } from './consultations.service';
import {
  ScheduleConsultationSchema,
  ScheduleConsultationDto,
} from './dto/schedule-consultation.dto';

@Controller('admin/consultations')
@UseInterceptors(ActivityLogInterceptor)
export class ConsultationsAdminController {
  constructor(private readonly consultationsService: ConsultationsService) {}

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

  @Patch(':id/status')
  @RequirePermission('portfolio', 'write')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.consultationsService.updateStatus(id, status);
  }

  @Patch(':id/schedule')
  @RequirePermission('portfolio', 'write')
  scheduleConsultation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ScheduleConsultationSchema)) dto: ScheduleConsultationDto,
  ) {
    return this.consultationsService.schedule(id, dto);
  }
}
