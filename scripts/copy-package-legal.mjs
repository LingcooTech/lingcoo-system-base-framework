import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const packageDirectory = process.cwd();
const repositoryRoot = path.resolve(packageDirectory, '../..');
const distributionDirectory = path.join(packageDirectory, 'dist');

await mkdir(distributionDirectory, { recursive: true });
await Promise.all(
  ['LICENSE', 'NOTICE'].map((file) =>
    copyFile(path.join(repositoryRoot, file), path.join(distributionDirectory, file)),
  ),
);
