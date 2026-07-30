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
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { ApiDataResponse } from '../common/swagger/api-data-response.decorator';
import { ConsultationTypeDto } from './dto/cms-response.dto';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CmsService } from './cms.service';

@ApiTags('CMS')
@ApiBearerAuth('access-token')
@Controller('admin/cms/consultations')
@UseInterceptors(ActivityLogInterceptor)
export class CmsConsultationsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get()
  @RequirePermission('cms', 'read')
  @ApiOperation({ summary: 'List consultation types with their form schemas' })
  @ApiDataResponse(ConsultationTypeDto, true)
  getConsultationTypes() {
    return this.cmsService.getConsultationTypes();
  }

  @Post()
  @RequirePermission('cms', 'write')
  @ApiOperation({
    summary: 'Create a consultation type',
    description: 'Fails with 400 if the key already exists. Keys are Arabic and double as the app route param.',
  })
  @ApiBody({ type: ConsultationTypeDto })
  @ApiCreatedResponse({ type: ConsultationTypeDto })
  createConsultationType(@Body() body: any) {
    return this.cmsService.createConsultationType(body);
  }

  @Patch(':key')
  @RequirePermission('cms', 'write')
  @ApiOperation({ summary: 'Patch a consultation type; the key itself is preserved' })
  @ApiParam({ name: 'key', example: 'نفسية', description: 'URL-encode Arabic keys' })
  @ApiBody({ type: ConsultationTypeDto })
  @ApiOkResponse({ type: ConsultationTypeDto })
  updateConsultationType(@Param('key') key: string, @Body() body: any) {
    return this.cmsService.updateConsultationType(key, body);
  }

  @Delete(':key')
  @RequirePermission('cms', 'write')
  @ApiOperation({ summary: 'Delete a consultation type' })
  @ApiParam({ name: 'key', example: 'psychological', description: 'URL-encode Arabic keys' })
  @ApiOkResponse({ type: ConsultationTypeDto, description: 'The removed type' })
  deleteConsultationType(@Param('key') key: string) {
    return this.cmsService.deleteConsultationType(key);
  }
}
