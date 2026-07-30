import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ApiDataResponse } from '../common/swagger/api-data-response.decorator';
import { CmsStateDto } from './dto/cms-response.dto';
import { CmsService } from './cms.service';

@ApiTags('CMS')
@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Full CMS state consumed by the mobile app',
    description:
      'Field names are the app contract (CmsState in @ahla/shared). Only published pages are returned. ' +
      'Schema v6 renamed schemaVersion→version and consultationTypes→consultations, and added media.',
  })
  @ApiDataResponse(CmsStateDto)
  getPublicSnapshot() {
    return this.cmsService.getPublicSnapshot();
  }
}
