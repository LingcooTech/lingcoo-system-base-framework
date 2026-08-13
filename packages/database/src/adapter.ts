import type {
  DatabaseAdapter,
  DatabaseConnection,
  DatabaseConnectionOptions,
} from '@lingcootech/frame-kernel/ports';

import { createDatabase, type Database } from './client.js';

export const POSTGRES_ADAPTER_ID = 'postgresql';

/** PostgreSQL/Drizzle implementation of the Kernel database port. */
export function createPostgresAdapter(): DatabaseAdapter<Database> {
  return {
    id: POSTGRES_ADAPTER_ID,
    connect(options: DatabaseConnectionOptions): DatabaseConnection<Database> {
      const handle = createDatabase(options.connectionString);
      return {
        client: handle.db,
        async ping() {
          await handle.pool.query('select 1');
        },
        async close() {
          await handle.pool.end();
        },
      };
    },
  };
}
