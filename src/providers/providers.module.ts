import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProvidersController } from './providers.controller';
import { ProvidersAdminController } from './providers-admin.controller';
import { ProviderPortalController } from './provider-portal.controller';

@Module({
  controllers: [ProvidersController, ProvidersAdminController, ProviderPortalController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
