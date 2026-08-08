import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import { PushService } from './push.service';
import { createPushClient, PUSH_CLIENT } from './push.client';
import { NotificationsController } from './notifications.controller';
import { NotificationsAdminController } from './notifications-admin.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [
    NotificationsService,
    PreferencesService,
    PushService,
    {
      // Resolved once at boot. Null when no Firebase credential is configured,
      // which PushService reports rather than silently ignoring. Supplying the
      // client through DI is also what lets the tests run with no Firebase at
      // all — they inject a fake and assert on what it was handed.
      provide: PUSH_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createPushClient(config),
    },
  ],
  exports: [NotificationsService, PreferencesService, PushService],
})
export class NotificationsModule {}
