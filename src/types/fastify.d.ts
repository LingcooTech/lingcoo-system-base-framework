import type { Database } from '../db/client.js';
import type { AppEnv } from '../lib/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    appEnv: AppEnv;
    db: Database;
  }
}
