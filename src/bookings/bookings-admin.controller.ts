import { Body, Controller, Get, Param, Patch, Query, Res, UsePipes, UseInterceptors } from '@nestjs/common';
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
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodBody, ApiZodQuery } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
/*
 * Bookings were the ONE admin surface with no audit trail: every content, CMS,
 * donation and user mutation was logged, but confirming, cancelling or marking a
 * booking no-show left no record of who did it. Bookings are the operational
 * core — the thing a beneficiary actually turns up for — so a status change is
 * exactly what an audit log is for (T-14, matrix row 35).
 */
@UseInterceptors(ActivityLogInterceptor)
@Controller('admin/bookings')
export class BookingsAdminController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * GET /admin/bookings
   * List bookings with filters, search, and pagination.
   */
  @ApiOperation({ summary: 'List bookings', description: 'Paginated. Requires bookings:read.' })
  @ApiZodQuery(BookingFiltersSchema)
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
  @ApiOperation({ summary: 'Update a booking status', description: 'The acting admin is recorded in the activity log. Requires bookings:write.' })
  @ApiZodBody(UpdateBookingStatusSchema)
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
  @ApiOperation({ summary: 'Reschedule a booking', description: 'Moves it to a new date and slot; the status is left alone. Requires bookings:write.' })
  @ApiBody({ schema: { type: 'object', required: ['date', 'timeSlot'], properties: { date: { type: 'string', format: 'date' }, timeSlot: { type: 'string', description: 'Must be one of the slots GET /services/{id}/availability returned' } } } })
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
  @ApiOperation({ summary: 'Calendar view for one provider', description: 'Requires bookings:read.' })
  @ApiQuery({ name: 'providerId', required: true })
  @ApiQuery({ name: 'from', required: true, schema: { type: 'string', format: 'date' }, description: 'Inclusive start, YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, schema: { type: 'string', format: 'date' }, description: 'Inclusive end, YYYY-MM-DD' })
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
  @ApiOperation({ summary: 'Export bookings', description: 'Accepts the same filters as the list. Returns a file, not the `{ data }` envelope. Requires bookings:read.' })
  @ApiZodQuery(BookingFiltersSchema)
  @ApiQuery({ name: 'format', required: false, schema: { type: 'string', default: 'csv' } })
  @ApiProduces('text/csv')
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
