import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:4000'),

  /**
   * ⚠️ Retired. Kept only so an existing deployment does not fail validation.
   *
   * An "FCM server key" authenticates the **legacy** FCM HTTP API, which Google
   * deprecated in June 2023 and shut down on **20 June 2024**. Row 49 of the
   * delivery matrix was filed BLOCKED waiting for this key — a credential that
   * would not have worked on arrival, for a feature that had no send path.
   *
   * Push uses `FIREBASE_SERVICE_ACCOUNT` below. If this is set, the app logs a
   * warning at boot saying it is ignored.
   */
  FCM_SERVER_KEY: z.string().optional(),

  /**
   * The Firebase service account, as JSON — Firebase console → Project settings
   * → Service accounts → Generate new private key. Either the JSON itself, or a
   * path to the file. Without one, push is disabled and says so at boot;
   * notifications still reach the in-app feed.
   */
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['ses', 'sendgrid', 'smtp']).default('smtp'),
  EMAIL_FROM: z.string().default('no-reply@ahlashabab.com'),
  EMAIL_PROVIDER_KEY: z.string().optional(),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  OTP_TTL: z.string().default('10m'),
  OTP_LENGTH: z.coerce.number().default(6),

  SMS_PROVIDER_KEY: z.string().optional(),
  SMS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  RATE_LIMIT_WINDOW: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  /**
   * How many reverse proxies sit in front of the app.
   *
   * Everything that identifies a caller — the rate limiter's bucket and the
   * `ip` column of the admin activity log — reads `request.ip`. Express only
   * derives that from `X-Forwarded-For` when it is told to trust the proxies;
   * otherwise it returns the socket peer, which behind a proxy is **the same
   * address for every visitor on earth**.
   *
   * This deployment answers through Cloudflare and an nginx in front of the
   * Node process, and this setting was absent — so the rate limits were one
   * global bucket. 100 requests a minute shared by every user, 5 admin login
   * attempts per 10 minutes shared by every administrator (one person mistyping
   * a password locked out the whole foundation), 5 OTP requests per 10 minutes
   * for the entire mobile user base, and an audit log whose `ip` column
   * recorded the proxy for every action ever taken.
   *
   * Left at `false` by default because the wrong value is its own bug: trusting
   * a hop that does not exist lets a caller set `X-Forwarded-For` freely and
   * skip the limits entirely. Set it to the number of proxies that actually
   * rewrite the header — see .env.example.
   */
  TRUST_PROXY: z.string().default('false'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  WEBHOOK_SECRET: z.string().optional(),

  /**
   * Escape hatch for local work only: lets the payment webhook accept unsigned
   * calls when no WEBHOOK_SECRET is configured. It is ignored in production —
   * see the superRefine below and `donations-webhook.controller.ts`.
   */
  ALLOW_UNSIGNED_WEBHOOKS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
})
  /**
   * Production must not start without a webhook secret.
   *
   * The controller already refuses to process unsigned callbacks, but a 503 at
   * callback time means the operator finds out only once real payments are
   * silently failing. Failing at boot moves the discovery to deploy time, which
   * is the only moment it is cheap to fix.
   */
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.WEBHOOK_SECRET || env.WEBHOOK_SECRET.length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WEBHOOK_SECRET'],
        message:
          'WEBHOOK_SECRET is required in production and must be at least 16 characters. '
          + 'Without it the payment webhook cannot verify that a callback came from the gateway.',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): EnvConfig => {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const formatted = parsed.error.format();
    console.error('Invalid environment variables:', formatted);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
};
