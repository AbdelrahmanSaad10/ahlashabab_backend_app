import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ActivityLogService } from './activity-log.service';

@Controller('admin/activity')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

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
