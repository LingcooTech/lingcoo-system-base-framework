import type { Database } from '@lingcootech/frame-database';
import type { FastifyInstance } from 'fastify';

interface IdentityDatabaseHost {
  db?: Database;
  frameKernel?: { database?: { client: unknown } };
}

export function resolveIdentityDatabase(app: FastifyInstance): Database {
  const host = app as FastifyInstance & IdentityDatabaseHost;
  const database = host.db ?? (host.frameKernel?.database?.client as Database | undefined);
  if (!database) throw new Error('Identity requires a configured PostgreSQL database adapter');
  return database;
}
