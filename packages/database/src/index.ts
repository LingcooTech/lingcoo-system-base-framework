export { createDatabase, type Database, type DatabaseHandle } from './client.js';
export { createPostgresAdapter, POSTGRES_ADAPTER_ID } from './adapter.js';
export * as schema from './schema.js';
export {
  FRAME_DATABASE_VERSION,
  frameMigrationSource,
  frameMigrationsDirectory,
  type Migration,
  type MigrationSource,
} from './migrations.js';
