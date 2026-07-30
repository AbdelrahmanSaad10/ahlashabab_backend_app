import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingSchema, CreateBookingDto } from './dto/create-booking.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /services/:serviceId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Public endpoint - returns available time slots for a service.
   */
  @ApiOperation({
    summary: 'Free time slots for a service',
    description: 'Call this before creating a booking — the slots it returns are the only values `timeSlot` accepts.',
  })
  @ApiQuery({ name: 'from', required: true, schema: { type: 'string', format: 'date' }, description: 'Inclusive start, YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, schema: { type: 'string', format: 'date' }, description: 'Inclusive end, YYYY-MM-DD' })
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
  @ApiOperation({
    summary: 'Create a booking',
    description: 'Auth is optional — send a bearer token to attach the booking to the account, or omit it to book as a guest. Returns a reference the guest can use to look it up.',
  })
  @ApiBearerAuth('access-token')
  @ApiZodBody(CreateBookingSchema)
  @OptionalAuth()
  @Post('bookings')
  @UsePipes(new ZodValidationPipe(CreateBookingSchema))
  create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.bookingsService.create(dto, user?.id);
  }

  /**
   * GET /bookings/:reference
   * Public lookup by booking reference code.
   */
  @ApiOperation({ summary: 'Look up a booking by reference', description: 'Public — lets a guest check a booking without an account.' })
  @ApiParam({ name: 'reference', description: 'Booking reference issued at creation' })
  @Public()
  @Get('bookings/:reference')
  findByReference(@Param('reference') reference: string) {
    return this.bookingsService.findByReference(reference);
  }
}
