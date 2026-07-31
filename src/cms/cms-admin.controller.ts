import {
  Body,
  Controller,
  Patch,
  Put,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CmsService } from './cms.service';
import {
  UpdateSettingsDto,
  UpdateSettingsSchema,
} from './dto/update-settings.dto';
import { UpdateMenuDto, UpdateMenuSchema } from './dto/update-menu.dto';
import { UpdateHomeDto, UpdateHomeSchema } from './dto/update-home.dto';
import { ImportCmsDto, ImportCmsSchema } from './dto/import-cms.dto';

@Controller('admin/cms')
@UseInterceptors(ActivityLogInterceptor)
export class CmsAdminController {
  constructor(private readonly cmsService: CmsService) {}

  @Put()
  @RequirePermission('cms', 'write')
  replaceState(@Body(new ZodValidationPipe(ImportCmsSchema)) body: ImportCmsDto) {
    return this.cmsService.replaceState(body);
  }

  @Patch('settings')
  @RequirePermission('cms', 'write')
  updateSettings(
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) dto: UpdateSettingsDto,
  ) {
    return this.cmsService.updateSettings(dto);
  }

  @Put('menu')
  @RequirePermission('cms', 'write')
  replaceMenu(
    @Body(new ZodValidationPipe(UpdateMenuSchema)) dto: UpdateMenuDto,
  ) {
    return this.cmsService.replaceMenu(dto.menu);
  }

  @Put('home')
  @RequirePermission('cms', 'write')
  replaceHome(
    @Body(new ZodValidationPipe(UpdateHomeSchema)) dto: UpdateHomeDto,
  ) {
    return this.cmsService.replaceHome(dto.sections);
  }
}
