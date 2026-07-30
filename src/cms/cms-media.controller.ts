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

@Controller('admin/cms/media')
@UseInterceptors(ActivityLogInterceptor)
export class CmsMediaController {
  constructor(private readonly cmsMediaService: CmsMediaService) {}

  @Get()
  @RequirePermission('cms', 'read')
  findAll(@Query('folder') folder?: string) {
    return this.cmsMediaService.findAll(folder);
  }

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

  @Delete(':id')
  @RequirePermission('cms', 'write')
  remove(@Param('id') id: string) {
    return this.cmsMediaService.remove(id);
  }
}
