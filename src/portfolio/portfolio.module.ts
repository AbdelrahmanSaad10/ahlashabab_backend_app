import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { FoundationController } from './foundation.controller';
import { PortfolioAdminController } from './portfolio-admin.controller';

@Module({
  controllers: [
    PortfolioController,
    FoundationController,
    PortfolioAdminController,
  ],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
