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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('CMS')
@ApiBearerAuth('access-token')
@Controller('admin/cms')
@UseInterceptors(ActivityLogInterceptor)
export class CmsToolsController {
  constructor(private readonly cmsService: CmsService) {}

  @ApiOperation({ summary: 'Export the CMS state', description: 'Returns the full state, drafts included — the round trip for POST /admin/cms/import. Requires cms:read.' })
  @Get('export')
  @RequirePermission('cms', 'read')
  exportState() {
    return this.cmsService.exportState();
  }

  @ApiOperation({ summary: 'Import a CMS state', description: 'Replaces the current state with the supplied one. Take a backup first. Requires cms:write.' })
  @ApiZodBody(ImportCmsSchema)
  @Post('import')
  @RequirePermission('cms', 'write')
  importState(
    @Body(new ZodValidationPipe(ImportCmsSchema)) dto: ImportCmsDto,
  ) {
    return this.cmsService.importState(dto);
  }

  @ApiOperation({ summary: 'Snapshot the current CMS state', description: 'Requires cms:write.' })
  @Post('backup')
  @RequirePermission('cms', 'write')
  createBackup() {
    return this.cmsService.createBackup();
  }
}
