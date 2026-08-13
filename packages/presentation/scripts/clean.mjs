import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
await rm(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'), {
  recursive: true,
  force: true,
});
