import { Module } from '@nestjs/common';
import { CmsService } from './cms.service';
import { CmsMigrationService } from './cms-migration.service';
import { CmsMediaService } from './cms-media.service';
import { CmsController } from './cms.controller';
import { CmsAdminController } from './cms-admin.controller';
import { CmsPagesController } from './cms-pages.controller';
import { CmsConsultationsController } from './cms-consultations.controller';
import { CmsMediaController } from './cms-media.controller';
import { CmsToolsController } from './cms-tools.controller';

@Module({
  controllers: [
    CmsController,
    CmsAdminController,
    CmsPagesController,
    CmsConsultationsController,
    CmsMediaController,
    CmsToolsController,
  ],
  providers: [CmsService, CmsMigrationService, CmsMediaService],
  exports: [CmsService],
})
export class CmsModule {}
