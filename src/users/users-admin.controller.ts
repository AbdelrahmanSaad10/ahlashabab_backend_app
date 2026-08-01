import {
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
import { UsersService } from './users.service';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('admin/users')
@UseInterceptors(ActivityLogInterceptor)
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'List app users', description: 'Paginated. Requires users:read.' })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search' })
  @ApiQuery({ name: 'governorate', required: false })
  @ApiQuery({ name: 'isGuest', required: false, schema: { type: 'boolean' }, description: 'Omit for both; `true`/`false` to filter' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } })
  @Get()
  @RequirePermission('users', 'read')
  findAll(
    @Query('q') q?: string,
    @Query('governorate') governorate?: string,
    @Query('isGuest') isGuest?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll({
      q,
      governorate,
      isGuest: isGuest !== undefined ? isGuest === 'true' : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @ApiOperation({ summary: 'Export users as CSV', description: 'Raw UTF-8 CSV with a BOM (so Excel reads the Arabic), not the usual `{ data }` envelope. Requires users:read.' })
  @ApiProduces('text/csv')
  @Get('export')
  @RequirePermission('users', 'read')
  async exportUsers(@Res() res: Response) {
    const csv = await this.usersService.exportUsers();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="users-export.csv"',
    );
    // BOM for Arabic/UTF-8 CSV in Excel
    res.send('\uFEFF' + csv);
  }

  @ApiOperation({ summary: "List one user's bookings", description: 'Requires users:read.' })
  @Get(':id/bookings')
  @RequirePermission('users', 'read')
  getUserBookings(@Param('id') id: string) {
    return this.usersService.getUserBookings(id);
  }

  @ApiOperation({ summary: 'Block or unblock a user', description: 'Toggles — there is no separate unblock route. A blocked user is rejected at token validation. Requires users:write.' })
  @Patch(':id/block')
  @RequirePermission('users', 'write')
  toggleBlock(@Param('id') id: string) {
    return this.usersService.toggleBlock(id);
  }
}
