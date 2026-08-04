export { createDatabase, type Database, type DatabaseHandle } from './client.js';
export * as schema from './schema.js';
export {
  FRAME_DATABASE_VERSION,
  frameMigrationSource,
  frameMigrationsDirectory,
  type Migration,
  type MigrationSource,
} from './migrations.js';
