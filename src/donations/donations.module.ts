import { Module } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationsController } from './donations.controller';
import { DonationsAdminController } from './donations-admin.controller';
import { DonationsWebhookController } from './donations-webhook.controller';

@Module({
  controllers: [
    DonationsController,
    DonationsAdminController,
    DonationsWebhookController,
  ],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}
