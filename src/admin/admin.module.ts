import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';

@Module({
  controllers: [RolesController, ActivityLogController],
  providers: [RolesService, ActivityLogService],
  exports: [RolesService, ActivityLogService],
})
export class AdminModule {}
