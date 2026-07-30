import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UsePipes,
} from '@nestjs/common';
import { Response } from 'express';
import { BookingsService } from './bookings.service';
import {
  BookingFiltersSchema,
  BookingFiltersDto,
} from './dto/booking-filters.dto';
import {
  UpdateBookingStatusSchema,
  UpdateBookingStatusDto,
} from './dto/update-booking-status.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';

@Controller('admin/bookings')
export class BookingsAdminController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /admin/bookings
   * List bookings with filters, search, and pagination.
   */
  @RequirePermission('bookings', 'read')
  @Get()
  @UsePipes(new ZodValidationPipe(BookingFiltersSchema))
  findAll(@Query() filters: BookingFiltersDto) {
    return this.bookingsService.findAll(filters);
  }

  /**
   * PATCH /admin/bookings/:id/status
   * Update a booking's status (state machine validated).
   */
  @RequirePermission('bookings', 'write')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBookingStatusSchema))
    dto: UpdateBookingStatusDto,
    @CurrentAdmin() admin: { id: string },
  ) {
    return this.bookingsService.updateStatus(id, dto.status, admin.id);
  }

  /**
   * PATCH /admin/bookings/:id
   * Reschedule a booking (change date/time without changing status).
   */
  @RequirePermission('bookings', 'write')
  @Patch(':id')
  reschedule(
    @Param('id') id: string,
    @Body('date') date: string,
    @Body('timeSlot') timeSlot: string,
  ) {
    return this.bookingsService.reschedule(id, date, timeSlot);
  }

  /**
   * GET /admin/bookings/calendar?providerId=&from=&to=
   * Calendar view: bookings grouped by date for a provider.
   */
  @RequirePermission('bookings', 'read')
  @Get('calendar')
  getCalendar(
    @Query('providerId') providerId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.bookingsService.getCalendar(providerId, from, to);
  }

  /**
   * GET /admin/bookings/export?format=csv|xlsx
   * Export bookings as CSV or XLSX.
   */
  @RequirePermission('bookings', 'read')
  @Get('export')
  async exportBookings(
    @Query() filters: BookingFiltersDto,
    @Query('format') format: string = 'csv',
    @Res() res: Response,
  ) {
    const data = await this.bookingsService.getExportData(filters);

    if (format === 'csv') {
      const header =
        'المرجع,الاسم,الهاتف,الخدمة,مقدم الخدمة,التاريخ,الوقت,الحالة,المحافظة';
      const rows = data.map((b) => {
        const dateStr = b.date.toISOString().split('T')[0];
        return [
          b.reference,
          b.applicantName,
          b.phone,
          b.service?.name ?? '',
          b.provider?.name ?? '',
          dateStr,
          b.timeSlot,
          b.status,
          b.governorate?.name ?? '',
        ].join(',');
      });

      const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM for Arabic support

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="bookings.csv"',
      );
      return res.send(csv);
    }

    // For xlsx format, return JSON (xlsx generation can be handled by a dedicated library)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="bookings.json"',
    );
    return res.json(data);
  }
}
