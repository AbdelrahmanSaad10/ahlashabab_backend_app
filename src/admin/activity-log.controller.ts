import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ActivityLogService } from './activity-log.service';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Activity log')
@ApiBearerAuth('access-token')
@Controller('admin/activity')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @ApiOperation({ summary: 'Read the admin audit log', description: 'Written by ActivityLogInterceptor on admin mutations. Requires roles:read.' })
  @ApiQuery({ name: 'actorId', required: false, description: 'Admin user id' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'from', required: false, schema: { type: 'string', format: 'date' } })
  @ApiQuery({ name: 'to', required: false, schema: { type: 'string', format: 'date' } })
  @ApiPaginationQuery({ q: false })
  @Get()
  @RequirePermission('roles', 'read')
  findAll(
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogService.findAll({
      actorId,
      entityType,
      from,
      to,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
