import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsAdminController } from './bookings-admin.controller';

/**
 * `PrismaService` was listed in `providers` here.
 *
 * `PrismaModule` is `@Global()` and already exports it, so this created a
 * **second `PrismaClient`** — with its own connection pool — used by everything
 * inside this module while the rest of the app used the global one. Prisma sizes
 * a pool at `cpus × 2 + 1`, so it was roughly double the connections for no
 * benefit, against a PostgreSQL sharing `max_connections` with three other
 * applications on the same box. `onModuleInit` also connected and disconnected
 * twice.
 *
 * Found by a test, not by reading: the health check reported the database up
 * while the instance the test had stubbed was rejecting, because the two were not
 * the same object.
 */
@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [BookingsController, BookingsAdminController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
