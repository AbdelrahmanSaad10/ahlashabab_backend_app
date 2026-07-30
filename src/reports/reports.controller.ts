import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';
import { ReportFiltersDto, ReportFiltersSchema } from './dto/report-filters.dto';

@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('bookings')
  @RequirePermission('reports', 'read')
  bookingReport(
    @Query(new ZodValidationPipe(ReportFiltersSchema)) filters: ReportFiltersDto,
  ) {
    return this.reportsService.bookingReport(filters);
  }

  @Get('utilization')
  @RequirePermission('reports', 'read')
  utilizationReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.utilizationReport(from, to);
  }

  @Get('donations')
  @RequirePermission('reports', 'read')
  donationReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.donationReport(from, to);
  }

  @Get('users')
  @RequirePermission('reports', 'read')
  userReport() {
    return this.reportsService.userReport();
  }

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
