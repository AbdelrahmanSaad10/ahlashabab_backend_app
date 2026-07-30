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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Volunteers')
@ApiBearerAuth('access-token')
@Controller('admin/volunteers')
@UseInterceptors(ActivityLogInterceptor)
export class VolunteersAdminController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @ApiOperation({ summary: 'List volunteer applications', description: 'Paginated. Requires portfolio:read.' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'governorateId', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search' })
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

  @ApiOperation({ summary: 'Update a volunteer application status', description: 'Requires portfolio:write.' })
  @ApiBody({ schema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } } })
  @Patch(':id/status')
  @RequirePermission('portfolio', 'write')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.volunteersService.updateStatus(id, status);
  }

  @ApiOperation({
    summary: 'Export volunteers as CSV',
    description:
      'Returns a UTF-8 CSV with a BOM and Arabic headers, not the usual `{ data }` envelope — '
      + 'the BOM is what makes Excel read the Arabic correctly. Requires portfolio:read.',
  })
  @ApiProduces('text/csv')
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
