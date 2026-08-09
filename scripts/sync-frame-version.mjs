import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { publicPackageDirectories, repositoryRoot } from './package-catalog.mjs';

const manifests = await Promise.all(
  publicPackageDirectories.map(async (directory) => {
    const manifestPath = path.join(repositoryRoot, directory, 'package.json');
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  }),
);
const versions = new Set(manifests.map((manifest) => manifest.version));
if (versions.size !== 1) {
  throw new Error(`Frame packages must use one version: ${[...versions].join(', ')}`);
}

const [frameVersion] = versions;

const frameworkManifestPath = path.join(repositoryRoot, 'lingcoo.framework.json');
const frameworkManifest = JSON.parse(await readFile(frameworkManifestPath, 'utf8'));
frameworkManifest.version = frameVersion;
await writeFile(frameworkManifestPath, `${JSON.stringify(frameworkManifest, null, 2)}\n`);

const versionSourcePath = path.join(repositoryRoot, 'packages/extension-sdk/src/index.ts');
const versionSource = await readFile(versionSourcePath, 'utf8');
const synchronizedSource = versionSource.replace(
  /export const FRAME_VERSION = '[^']+';/,
  `export const FRAME_VERSION = '${frameVersion}';`,
);
if (synchronizedSource === versionSource && !versionSource.includes(`'${frameVersion}'`)) {
  throw new Error('Could not synchronize FRAME_VERSION.');
}
await writeFile(versionSourcePath, synchronizedSource);

const databaseVersionPath = path.join(repositoryRoot, 'packages/database/src/migrations.ts');
const databaseVersionSource = await readFile(databaseVersionPath, 'utf8');
const synchronizedDatabaseVersion = databaseVersionSource.replace(
  /export const FRAME_DATABASE_VERSION = '[^']+';/,
  `export const FRAME_DATABASE_VERSION = '${frameVersion}';`,
);
if (
  synchronizedDatabaseVersion === databaseVersionSource &&
  !databaseVersionSource.includes(`'${frameVersion}'`)
) {
  throw new Error('Could not synchronize FRAME_DATABASE_VERSION.');
}
await writeFile(databaseVersionPath, synchronizedDatabaseVersion);

const fixturePath = path.join(repositoryRoot, 'fixtures/consumer/package.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
for (const manifest of manifests) fixture.dependencies[manifest.name] = frameVersion;
await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);

const fixtureUiPath = path.join(repositoryRoot, 'fixtures/consumer/ui.tsx');
const fixtureUi = await readFile(fixtureUiPath, 'utf8');
await writeFile(
  fixtureUiPath,
  fixtureUi.replace(
    /frame=\{\{ name: 'Lingcoo Frame', version: '[^']+' \}\}/,
    `frame={{ name: 'Lingcoo Frame', version: '${frameVersion}' }}`,
  ),
);

console.log(`Synchronized Frame runtime and Consumer fixture at ${frameVersion}.`);
