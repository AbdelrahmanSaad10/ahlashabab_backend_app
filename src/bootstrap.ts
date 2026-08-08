import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { applyTrustProxy } from './common/utils/trust-proxy.util';

/**
 * Everything that turns a bare Nest app into *this* API.
 *
 * It lived inline in `main.ts`, which meant anything that booted `AppModule`
 * another way got a different application. `scripts/qa-env.ts` did exactly that,
 * and the difference showed up the first time a browser tried to use it: no
 * `enableCors`, so the dashboard's preflight got a 404 and every request failed
 * with `net::ERR_FAILED`. The QA environment could serve curl and not a browser —
 * which is half of what QA needs it for.
 *
 * Swagger and `listen()` stay in `main.ts`. This is the part that changes how the
 * API *behaves*, and it belongs in one place so a test environment cannot quietly
 * differ from production in a way nobody notices until something breaks.
 */
export function configureApp(app: INestApplication, config: ConfigService): void {
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

  app.setGlobalPrefix('api/v1');

  /*
   * Who the caller is, according to Express — the rate limiter's bucket and the
   * `ip` on every admin audit row. Behind a proxy it is the proxy's address
   * unless the chain is trusted, so every visitor shared one bucket. See
   * TRUST_PROXY in app.config.ts.
   */
  applyTrustProxy(app, config.get<string>('TRUST_PROXY'));

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });
}
