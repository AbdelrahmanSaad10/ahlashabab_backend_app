import {
  Body,
  Controller,
  Get,
  Post,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CmsService } from './cms.service';
import { ImportCmsDto, ImportCmsSchema } from './dto/import-cms.dto';

@Controller('admin/cms')
@UseInterceptors(ActivityLogInterceptor)
export class CmsToolsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('export')
  @RequirePermission('cms', 'read')
  exportState() {
    return this.cmsService.exportState();
  }

  @Post('import')
  @RequirePermission('cms', 'write')
  importState(
    @Body(new ZodValidationPipe(ImportCmsSchema)) dto: ImportCmsDto,
  ) {
    return this.cmsService.importState(dto);
  }

  @Post('backup')
  @RequirePermission('cms', 'write')
  createBackup() {
    return this.cmsService.createBackup();
  }
}
