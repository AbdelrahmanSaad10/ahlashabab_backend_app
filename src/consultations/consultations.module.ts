import { Module } from '@nestjs/common';
import { ConsultationsService } from './consultations.service';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsAdminController } from './consultations-admin.controller';

@Module({
  controllers: [ConsultationsController, ConsultationsAdminController],
  providers: [ConsultationsService],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
