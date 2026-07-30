import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { ArticlesAdminController } from './articles-admin.controller';

@Module({
  controllers: [ArticlesController, ArticlesAdminController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
