import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsAdminController } from './bookings-admin.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [BookingsController, BookingsAdminController],
  providers: [BookingsService, PrismaService],
  exports: [BookingsService],
})
export class BookingsModule {}
