import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

// Infrastructure
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { EmailModule } from './email/email.module';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { GovernoratesModule } from './governorates/governorates.module';
import { ServicesModule } from './services/services.module';
import { ProvidersModule } from './providers/providers.module';
import { BookingsModule } from './bookings/bookings.module';
import { DonationsModule } from './donations/donations.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ArticlesModule } from './articles/articles.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { ContactModule } from './contact/contact.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CmsModule } from './cms/cms.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Infrastructure
    AppConfigModule,
    PrismaModule,
    CommonModule,
    EmailModule,
    EventEmitterModule.forRoot(),

    // Serve uploaded files
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          rootPath: join(process.cwd(), config.get<string>('UPLOAD_DIR') ?? './uploads'),
          serveRoot: '/uploads',
        },
      ],
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    CategoriesModule,
    GovernoratesModule,
    ServicesModule,
    ProvidersModule,
    BookingsModule,
    DonationsModule,
    PortfolioModule,
    ArticlesModule,
    ConsultationsModule,
    VolunteersModule,
    ContactModule,
    NotificationsModule,
    CmsModule,
    ReportsModule,
    AdminModule,
    UploadModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
