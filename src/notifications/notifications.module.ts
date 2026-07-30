import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsAdminController } from './notifications-admin.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [NotificationsService, PreferencesService],
  exports: [NotificationsService, PreferencesService],
})
export class NotificationsModule {}
