#!/usr/bin/env node

import { runSystemMigrations } from '@lingcootech/frame';

import { applicationSystem } from './system.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
await runSystemMigrations({ connectionString, system: applicationSystem });
