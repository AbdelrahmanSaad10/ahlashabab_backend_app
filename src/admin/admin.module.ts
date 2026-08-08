import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';

@Module({
  controllers: [RolesController, ActivityLogController, AdminUsersController],
  providers: [RolesService, ActivityLogService, AdminUsersService],
  exports: [RolesService, ActivityLogService, AdminUsersService],
})
export class AdminModule {}
