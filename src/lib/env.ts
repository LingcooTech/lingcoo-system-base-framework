import { z } from 'zod';

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().default('lingcoo-system-base-framework'),
    APP_VERSION: z.string().default('development'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(8090),
    CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),
    DATABASE_URL: z
      .string()
      .default('postgres://lingcoo_base:lingcoo_base_password@localhost:5437/lingcoo_base'),
    SETTINGS_ENCRYPTION_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(32).optional(),
    ),
    AUTH_JWT_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(32).optional(),
    ),
    AUTH_COOKIE_NAME: z.string().min(1).default('lingcoo_frame_session'),
    AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    AUTH_BOOTSTRAP_EMAIL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.email().optional(),
    ),
    AUTH_BOOTSTRAP_PASSWORD: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(12).max(128).optional(),
    ),
    AUTH_BOOTSTRAP_DISPLAY_NAME: z.string().min(1).max(120).default('系统所有者'),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(10_000).default(1000),
    WORKER_STALE_TIMEOUT_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(300_000),
    WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(8091),
    LOG_LEVEL: logLevelSchema.default('info'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && !env.DATABASE_URL.startsWith('postgres')) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Production DATABASE_URL must be a PostgreSQL connection string',
      });
    }
    if (env.NODE_ENV === 'production' && !env.AUTH_JWT_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_JWT_SECRET'],
        message: 'Production AUTH_JWT_SECRET is required',
      });
    }
    if (Boolean(env.AUTH_BOOTSTRAP_EMAIL) !== Boolean(env.AUTH_BOOTSTRAP_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_BOOTSTRAP_PASSWORD'],
        message: 'Bootstrap email and password must be provided together',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
