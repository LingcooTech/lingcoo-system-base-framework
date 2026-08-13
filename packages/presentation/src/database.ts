import type { Database } from '@lingcootech/frame-database';
import type { FastifyInstance } from 'fastify';
export function resolvePresentationDatabase(app: FastifyInstance): Database {
  const host = app as FastifyInstance & { db?: Database };
  if (!host.db) throw new Error('Presentation requires a configured PostgreSQL database adapter');
  return host.db;
}
