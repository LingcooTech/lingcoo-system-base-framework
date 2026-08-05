#!/usr/bin/env node

import { runSystemMigrations } from './runtime/migrations.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

await runSystemMigrations({ connectionString });
