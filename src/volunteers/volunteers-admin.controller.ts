import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { VolunteersService } from './volunteers.service';

@Controller('admin/volunteers')
@UseInterceptors(ActivityLogInterceptor)
export class VolunteersAdminController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @Get()
  @RequirePermission('portfolio', 'read')
  findAll(
    @Query('status') status?: string,
    @Query('governorateId') governorateId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.volunteersService.findAll({
      status,
      governorateId: governorateId ? parseInt(governorateId, 10) : undefined,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Patch(':id/status')
  @RequirePermission('portfolio', 'write')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.volunteersService.updateStatus(id, status);
  }

  @Get('export')
  @RequirePermission('portfolio', 'read')
  async exportCsv(@Res() res: Response) {
    const data = await this.volunteersService.exportCsv();

    const header = 'الاسم,الهاتف,العمر,المحافظة,الاهتمامات,التوفر,الحالة,تاريخ التقديم\n';
    const rows = data
      .map(
        (row) =>
          `"${row.name}","${row.phone}","${row.age ?? ''}","${row.governorateId ?? ''}","${(row.interestsJson as string[])?.join('، ') ?? ''}","${row.availability ?? ''}","${row.status}","${row.createdAt.toISOString()}"`,
      )
      .join('\n');

    const csv = '\uFEFF' + header + rows;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=volunteers.csv');
    res.send(csv);
  }
}
