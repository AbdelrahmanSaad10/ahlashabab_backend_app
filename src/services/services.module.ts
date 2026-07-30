import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { ServicesAdminController } from './services-admin.controller';

@Module({
  controllers: [ServicesController, ServicesAdminController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
