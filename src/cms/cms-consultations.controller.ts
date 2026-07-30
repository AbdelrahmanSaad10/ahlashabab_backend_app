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

@Controller('admin/cms/consultations')
@UseInterceptors(ActivityLogInterceptor)
export class CmsConsultationsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get()
  @RequirePermission('cms', 'read')
  getConsultationTypes() {
    return this.cmsService.getConsultationTypes();
  }

  @Post()
  @RequirePermission('cms', 'write')
  createConsultationType(@Body() body: any) {
    return this.cmsService.createConsultationType(body);
  }

  @Patch(':key')
  @RequirePermission('cms', 'write')
  updateConsultationType(@Param('key') key: string, @Body() body: any) {
    return this.cmsService.updateConsultationType(key, body);
  }

  @Delete(':key')
  @RequirePermission('cms', 'write')
  deleteConsultationType(@Param('key') key: string) {
    return this.cmsService.deleteConsultationType(key);
  }
}
