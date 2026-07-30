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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('CMS')
@ApiBearerAuth('access-token')
@Controller('admin/cms')
@UseInterceptors(ActivityLogInterceptor)
export class CmsAdminController {
  constructor(private readonly cmsService: CmsService) {}

  @ApiOperation({
    summary: 'Replace the entire CMS state',
    description:
      'Blunt instrument — overwrites the whole blob. The body is not validated (`any`), so a malformed '
      + 'payload is stored as sent. Prefer the targeted routes below. Requires cms:write.',
  })
  @ApiBody({ schema: { type: 'object', description: 'A full CmsState — see the CmsStateDto schema on GET /cms' } })
  @Put()
  @RequirePermission('cms', 'write')
  replaceState(@Body() body: any) {
    return this.cmsService.replaceState(body);
  }

  @ApiOperation({ summary: 'Update CMS settings', description: 'Partial merge. Requires cms:write.' })
  @ApiZodBody(UpdateSettingsSchema)
  @Patch('settings')
  @RequirePermission('cms', 'write')
  updateSettings(
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) dto: UpdateSettingsDto,
  ) {
    return this.cmsService.updateSettings(dto);
  }

  @ApiOperation({ summary: 'Replace the app menu', description: 'PUT semantics — send every group. Requires cms:write.' })
  @ApiZodBody(UpdateMenuSchema)
  @Put('menu')
  @RequirePermission('cms', 'write')
  replaceMenu(
    @Body(new ZodValidationPipe(UpdateMenuSchema)) dto: UpdateMenuDto,
  ) {
    return this.cmsService.replaceMenu(dto.menu);
  }

  @ApiOperation({ summary: 'Replace the home section list', description: 'PUT semantics — send every section, in the order they should render. Requires cms:write.' })
  @ApiZodBody(UpdateHomeSchema)
  @Put('home')
  @RequirePermission('cms', 'write')
  replaceHome(
    @Body(new ZodValidationPipe(UpdateHomeSchema)) dto: UpdateHomeDto,
  ) {
    return this.cmsService.replaceHome(dto.sections);
  }
}
