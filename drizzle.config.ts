import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/database/src/schema.ts',
  out: './packages/database/drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://lingcoo_base:lingcoo_base_password@localhost:5437/lingcoo_base',
  },
});
