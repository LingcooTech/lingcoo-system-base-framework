import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { publicPackageDirectories, repositoryRoot } from './package-catalog.mjs';

const revision = (process.env.GITHUB_SHA ?? process.argv[2] ?? '').trim().slice(0, 8);
if (!/^[0-9a-f]{7,8}$/i.test(revision)) {
  throw new Error('A Git commit SHA is required through GITHUB_SHA or the first argument.');
}

const manifests = [];
for (const directory of publicPackageDirectories) {
  const manifestPath = path.join(repositoryRoot, directory, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifests.push({ manifest, manifestPath });
}

const packageNames = new Set(manifests.map(({ manifest }) => manifest.name));
const versions = new Set(manifests.map(({ manifest }) => manifest.version));
if (versions.size !== 1) {
  throw new Error(
    `Frame packages must have one version before canary publishing: ${[...versions]}`,
  );
}

const [currentVersion] = versions;
const stableVersion = currentVersion.replace(/-.+$/, '');
const canaryVersion = `${stableVersion}-canary.${revision.toLowerCase()}`;
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

for (const { manifest, manifestPath } of manifests) {
  manifest.version = canaryVersion;
  for (const field of dependencyFields) {
    for (const dependencyName of Object.keys(manifest[field] ?? {})) {
      if (packageNames.has(dependencyName)) manifest[field][dependencyName] = canaryVersion;
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`Prepared ${manifests.length} Frame packages at ${canaryVersion}.`);
