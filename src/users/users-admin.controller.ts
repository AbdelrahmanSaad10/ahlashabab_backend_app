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

@Controller('admin/users')
@UseInterceptors(ActivityLogInterceptor)
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

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

  @Get(':id/bookings')
  @RequirePermission('users', 'read')
  getUserBookings(@Param('id') id: string) {
    return this.usersService.getUserBookings(id);
  }

  @Patch(':id/block')
  @RequirePermission('users', 'write')
  toggleBlock(@Param('id') id: string) {
    return this.usersService.toggleBlock(id);
  }
}
