#!/usr/bin/env node

import { runMigrations } from './migrations.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

await runMigrations({ connectionString });
