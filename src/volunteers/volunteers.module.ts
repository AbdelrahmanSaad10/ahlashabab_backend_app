import { Module } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { VolunteersController } from './volunteers.controller';
import { VolunteersAdminController } from './volunteers-admin.controller';

@Module({
  controllers: [VolunteersController, VolunteersAdminController],
  providers: [VolunteersService],
  exports: [VolunteersService],
})
export class VolunteersModule {}
