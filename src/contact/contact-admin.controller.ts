import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ContactService } from './contact.service';

@Controller('admin/messages')
@UseInterceptors(ActivityLogInterceptor)
export class ContactAdminController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @RequirePermission('portfolio', 'read')
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.contactService.findAll({
      status,
      q,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Patch(':id')
  @RequirePermission('portfolio', 'write')
  updateMessage(
    @Param('id') id: string,
    @Body() dto: { status?: string; note?: string },
  ) {
    return this.contactService.updateMessage(id, dto);
  }
}
