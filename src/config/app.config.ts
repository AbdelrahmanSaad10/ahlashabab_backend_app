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

  FCM_SERVER_KEY: z.string().optional(),

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

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  WEBHOOK_SECRET: z.string().optional(),

  TRUST_PROXY: z.string().optional(),
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
