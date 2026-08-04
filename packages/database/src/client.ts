import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
}

export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
