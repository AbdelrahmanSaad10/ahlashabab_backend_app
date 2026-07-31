import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingSchema, CreateBookingDto } from './dto/create-booking.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /services/:serviceId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Public endpoint - returns available time slots for a service.
   */
  @Public()
  @Get('services/:serviceId/availability')
  getAvailability(
    @Param('serviceId') serviceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.bookingsService.getAvailability(serviceId, from, to);
  }

  /**
   * POST /bookings
   * Create a new booking. Supports both guest and authenticated users.
   */
  @OptionalAuth()
  @Post('bookings')
  create(
    @Body(new ZodValidationPipe(CreateBookingSchema)) dto: CreateBookingDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.bookingsService.create(dto, user?.id);
  }

  /**
   * GET /bookings/:reference
   * Public lookup by booking reference code.
   */
  @Public()
  @Get('bookings/:reference')
  findByReference(@Param('reference') reference: string) {
    return this.bookingsService.findByReference(reference);
  }
}
