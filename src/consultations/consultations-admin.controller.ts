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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

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
    description: 'Requires portfolio:write. Sending `تم تحديد موعد` marks it scheduled — see BACKEND.md §20 for how that relates to bookings.',
  })
  @ApiBody({ schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', example: 'تم تحديد موعد' } } } })
  @Patch(':id/status')
  @RequirePermission('portfolio', 'write')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.consultationsService.updateStatus(id, status);
  }
}
