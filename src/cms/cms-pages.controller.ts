import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CmsService } from './cms.service';

@Controller('admin/cms/pages')
@UseInterceptors(ActivityLogInterceptor)
export class CmsPagesController {
  constructor(private readonly cmsService: CmsService) {}

  @Get()
  @RequirePermission('cms', 'read')
  getPages() {
    return this.cmsService.getPages();
  }

  @Post()
  @RequirePermission('cms', 'write')
  createPage(@Body() body: any) {
    return this.cmsService.createPage(body);
  }

  @Patch(':id')
  @RequirePermission('cms', 'write')
  updatePage(@Param('id') id: string, @Body() body: any) {
    return this.cmsService.updatePage(id, body);
  }

  @Delete(':id')
  @RequirePermission('cms', 'write')
  deletePage(@Param('id') id: string) {
    return this.cmsService.deletePage(id);
  }

  @Patch(':id/status')
  @RequirePermission('cms', 'write')
  togglePagePublish(@Param('id') id: string) {
    return this.cmsService.togglePagePublish(id);
  }
}
