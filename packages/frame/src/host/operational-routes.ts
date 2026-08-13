import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

/** Compatibility Host probes. New hosts use @lingcootech/frame-fastify. */
export function registerOperationalRoutes(app: FastifyInstance): void {
  app.get('/health', async () => ({
    status: 'ok',
    name: app.appEnv.APP_NAME,
    version: app.appEnv.APP_VERSION,
    environment: app.appEnv.NODE_ENV,
    uptime: Math.round(process.uptime()),
  }));

  app.get('/ready', async (_request, reply) => {
    try {
      await app.db.execute(sql`select 1`);
      return { status: 'ready', database: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'not_ready', database: 'unavailable' });
    }
  });
}
