import {
  Body,
  Controller,
  Patch,
  Put,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';
import { CmsService } from './cms.service';
import {
  UpdateSettingsDto,
  UpdateSettingsSchema,
} from './dto/update-settings.dto';
import { UpdateMenuDto, UpdateMenuSchema } from './dto/update-menu.dto';
import { UpdateHomeDto, UpdateHomeSchema } from './dto/update-home.dto';
import { ImportCmsDto, ImportCmsSchema } from './dto/import-cms.dto';

@ApiTags('CMS Admin')
@ApiBearerAuth()
@Controller('admin/cms')
@UseInterceptors(ActivityLogInterceptor)
export class CmsAdminController {
  constructor(private readonly cmsService: CmsService) {}

  @Put()
  @RequirePermission('cms', 'write')
  @ApiOperation({ summary: 'Replace entire CMS state' })
  @ApiZodBody(ImportCmsSchema, 'Full CMS state blob')
  replaceState(@Body(new ZodValidationPipe(ImportCmsSchema)) body: ImportCmsDto) {
    return this.cmsService.replaceState(body);
  }

  @Patch('settings')
  @RequirePermission('cms', 'write')
  @ApiOperation({
    summary: 'Update CMS settings',
    description:
      'Partial merge into settings_json. Uses a strict schema — unknown keys are rejected. '
      + 'Requires cms:write.',
  })
  @ApiZodBody(UpdateSettingsSchema, 'Partial settings object')
  updateSettings(
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) dto: UpdateSettingsDto,
  ) {
    return this.cmsService.updateSettings(dto);
  }

  @Put('menu')
  @RequirePermission('cms', 'write')
  @ApiOperation({ summary: 'Replace menu groups' })
  @ApiZodBody(UpdateMenuSchema, 'Menu groups array')
  replaceMenu(
    @Body(new ZodValidationPipe(UpdateMenuSchema)) dto: UpdateMenuDto,
  ) {
    return this.cmsService.replaceMenu(dto.menu);
  }

  @Put('home')
  @RequirePermission('cms', 'write')
  @ApiOperation({ summary: 'Replace home sections' })
  @ApiZodBody(UpdateHomeSchema, 'Home sections array')
  replaceHome(
    @Body(new ZodValidationPipe(UpdateHomeSchema)) dto: UpdateHomeDto,
  ) {
    return this.cmsService.replaceHome(dto.sections);
  }
}
