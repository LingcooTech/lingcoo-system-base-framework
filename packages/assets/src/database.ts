import type { Database } from '@lingcootech/frame-database';
import type { FastifyInstance } from 'fastify';

export function resolveAssetsDatabase(app: FastifyInstance): Database {
  const host = app as FastifyInstance & {
    db?: Database;
    frameKernel?: { database?: { client: unknown } };
  };
  const database = host.db ?? (host.frameKernel?.database?.client as Database | undefined);
  if (!database) throw new Error('Assets requires a configured PostgreSQL database adapter');
  return database;
}
