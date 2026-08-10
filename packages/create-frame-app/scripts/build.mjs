import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(packageRoot, '../..');
const dist = path.join(packageRoot, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(packageRoot, 'src/cli.mjs'), path.join(dist, 'cli.mjs'));
await cp(path.join(packageRoot, 'src/generator.mjs'), path.join(dist, 'generator.mjs'));
await cp(path.join(repositoryRoot, 'templates/application'), path.join(dist, 'template'), {
  recursive: true,
});
