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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('CMS')
@ApiBearerAuth('access-token')
@Controller('admin/cms/pages')
@UseInterceptors(ActivityLogInterceptor)
export class CmsPagesController {
  constructor(private readonly cmsService: CmsService) {}

  @ApiOperation({ summary: 'List CMS pages (drafts included)', description: 'GET /cms returns only published pages. Requires cms:read.' })
  @Get()
  @RequirePermission('cms', 'read')
  getPages() {
    return this.cmsService.getPages();
  }

  @ApiOperation({ summary: 'Create a CMS page', description: 'The body is not validated (`any`) — it is stored as sent. Requires cms:write.' })
  @ApiBody({ schema: { type: 'object', description: 'A CmsPage — see the pages entry on GET /cms' } })
  @Post()
  @RequirePermission('cms', 'write')
  createPage(@Body() body: any) {
    return this.cmsService.createPage(body);
  }

  @ApiOperation({ summary: 'Update a CMS page', description: 'The body is not validated (`any`). Requires cms:write.' })
  @ApiBody({ schema: { type: 'object' } })
  @Patch(':id')
  @RequirePermission('cms', 'write')
  updatePage(@Param('id') id: string, @Body() body: any) {
    return this.cmsService.updatePage(id, body);
  }

  @ApiOperation({ summary: 'Delete a CMS page', description: 'Any menu item pointing at it will dead-end. Requires cms:write.' })
  @Delete(':id')
  @RequirePermission('cms', 'write')
  deletePage(@Param('id') id: string) {
    return this.cmsService.deletePage(id);
  }

  @ApiOperation({ summary: 'Publish or unpublish a CMS page', description: 'Toggles. Only published pages reach the app. Requires cms:write.' })
  @Patch(':id/status')
  @RequirePermission('cms', 'write')
  togglePagePublish(@Param('id') id: string) {
    return this.cmsService.togglePagePublish(id);
  }
}
