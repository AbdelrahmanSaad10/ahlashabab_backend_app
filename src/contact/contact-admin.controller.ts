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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Contact')
@ApiBearerAuth('access-token')
@Controller('admin/messages')
@UseInterceptors(ActivityLogInterceptor)
export class ContactAdminController {
  constructor(private readonly contactService: ContactService) {}

  @ApiOperation({ summary: 'List contact messages', description: 'Paginated. Requires portfolio:read.' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search' })
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

  @ApiOperation({ summary: 'Update a contact message', description: 'Set a status and/or attach an internal note. Requires portfolio:write.' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' }, note: { type: 'string' } } } })
  @Patch(':id')
  @RequirePermission('portfolio', 'write')
  updateMessage(
    @Param('id') id: string,
    @Body() dto: { status?: string; note?: string },
  ) {
    return this.contactService.updateMessage(id, dto);
  }
}
