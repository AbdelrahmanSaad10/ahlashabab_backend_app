import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security — allow Swagger UI inline scripts/styles
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
          fontSrc: ["'self'", 'cdn.jsdelivr.net'],
        },
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('أحلى شباب API')
    .setDescription('Backend API for Ahla Shabab Foundation — جمعية خواطر أحلى شباب')
    .setVersion('1.0.0')
    // Without a server entry, generated clients have no base URL to target.
    .addServer('https://portfolio.27lashabab.com', 'production')
    .addServer('http://localhost:4000', 'local')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('Auth', 'OTP & admin authentication')
    .addTag('Categories', 'Service categories (public + admin)')
    .addTag('Services', 'Service catalog (public + admin)')
    .addTag('Providers', 'Service providers (public + admin)')
    .addTag('Bookings', 'Booking engine (availability, create, manage)')
    .addTag('Donations', 'Donation management + webhooks')
    .addTag('Portfolio', 'Cases, projects, foundation content')
    .addTag('Users', 'User profile, favorites, device tokens')
    .addTag('Articles', 'News & activities')
    .addTag('Consultations', 'Consultation requests')
    .addTag('Volunteers', 'Volunteer applications')
    .addTag('Contact', 'Contact messages')
    .addTag('Notifications', 'In-app notifications & preferences')
    .addTag('CMS', 'Headless CMS management')
    .addTag('Reports', 'Analytics & exports')
    .addTag('Admin', 'Roles & activity log')
    .addTag('Upload', 'Media upload & processing')
    .addTag('Health', 'Health check & testing')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'أحلى شباب API Docs',
  });

  // CORS
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs on http://localhost:${port}/api/docs`);
}

bootstrap();
