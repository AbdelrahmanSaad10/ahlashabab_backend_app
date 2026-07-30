import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CmsService } from './cms.service';

@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Public()
  @Get()
  getPublicSnapshot() {
    return this.cmsService.getPublicSnapshot();
  }
}
