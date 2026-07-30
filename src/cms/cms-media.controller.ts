import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CmsMediaService } from './cms-media.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('CMS')
@ApiBearerAuth('access-token')
@Controller('admin/cms/media')
@UseInterceptors(ActivityLogInterceptor)
export class CmsMediaController {
  constructor(private readonly cmsMediaService: CmsMediaService) {}

  @ApiOperation({ summary: 'List media items', description: 'Requires cms:read.' })
  @ApiQuery({ name: 'folder', required: false, description: 'Filter to one folder' })
  @Get()
  @RequirePermission('cms', 'read')
  findAll(@Query('folder') folder?: string) {
    return this.cmsMediaService.findAll(folder);
  }

  @ApiOperation({
    summary: 'Upload a media item',
    description: 'Multipart. The stored `srcUrl` is exposed to the app as `src` on GET /cms. Requires cms:write.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        alt: { type: 'string', description: 'Alt text — worth setting, the app renders it' },
        caption: { type: 'string' },
        folder: { type: 'string' },
      },
    },
  })
  @Post()
  @RequirePermission('cms', 'write')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('alt') alt?: string,
    @Body('caption') caption?: string,
    @Body('folder') folder?: string,
  ) {
    return this.cmsMediaService.upload(file, { title, alt, caption, folder });
  }

  @ApiOperation({ summary: 'Delete a media item', description: 'Any CMS reference to it resolves to nothing afterwards. Requires cms:write.' })
  @Delete(':id')
  @RequirePermission('cms', 'write')
  remove(@Param('id') id: string) {
    return this.cmsMediaService.remove(id);
  }
}
