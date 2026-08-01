import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';
import { ReportFiltersDto, ReportFiltersSchema } from './dto/report-filters.dto';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodQuery } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Booking report', description: 'Requires reports:read.' })
  @ApiZodQuery(ReportFiltersSchema)
  @Get('bookings')
  @RequirePermission('reports', 'read')
  bookingReport(
    @Query(new ZodValidationPipe(ReportFiltersSchema)) filters: ReportFiltersDto,
  ) {
    return this.reportsService.bookingReport(filters);
  }

  @ApiOperation({ summary: 'Provider utilization report', description: 'Requires reports:read.' })
  @ApiQuery({ name: 'from', required: false, schema: { type: 'string', format: 'date' } })
  @ApiQuery({ name: 'to', required: false, schema: { type: 'string', format: 'date' } })
  @Get('utilization')
  @RequirePermission('reports', 'read')
  utilizationReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.utilizationReport(from, to);
  }

  @ApiOperation({ summary: 'Donation report', description: 'Requires reports:read.' })
  @ApiQuery({ name: 'from', required: false, schema: { type: 'string', format: 'date' } })
  @ApiQuery({ name: 'to', required: false, schema: { type: 'string', format: 'date' } })
  @Get('donations')
  @RequirePermission('reports', 'read')
  donationReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.donationReport(from, to);
  }

  @ApiOperation({ summary: 'User report', description: 'Takes no filters. Requires reports:read.' })
  @Get('users')
  @RequirePermission('reports', 'read')
  userReport() {
    return this.reportsService.userReport();
  }

  @ApiOperation({ summary: 'Export a report', description: 'Streams a file rather than the `{ data }` envelope. Requires reports:read.' })
  @ApiQuery({ name: 'type', required: true, description: 'Which report to export' })
  @ApiQuery({ name: 'format', required: true, description: 'e.g. csv or pdf' })
  @ApiQuery({ name: 'from', required: false, schema: { type: 'string', format: 'date' } })
  @ApiQuery({ name: 'to', required: false, schema: { type: 'string', format: 'date' } })
  @ApiProduces('text/csv', 'application/pdf')
  @Get('export')
  @RequirePermission('reports', 'read')
  async exportData(
    @Query('type') type: string,
    @Query('format') format: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const filters: ReportFiltersDto = { from, to };
    const result = await this.reportsService.exportData(type, format, filters);

    res!.setHeader('Content-Type', result.contentType);
    res!.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res!.send(result.buffer);
  }
}
