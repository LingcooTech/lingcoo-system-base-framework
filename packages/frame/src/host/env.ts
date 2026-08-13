import { z } from 'zod';

import { attachEnvironmentSource } from './environment-source.js';

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
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(10_000).default(1000),
    WORKER_STALE_TIMEOUT_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(300_000),
    WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(8091),
    LOG_LEVEL: logLevelSchema.default('info'),
    METRICS_BEARER_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(24).optional(),
    ),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && !env.DATABASE_URL.startsWith('postgres')) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'Production DATABASE_URL must be a PostgreSQL connection string',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return attachEnvironmentSource(envSchema.parse(source), source);
}
