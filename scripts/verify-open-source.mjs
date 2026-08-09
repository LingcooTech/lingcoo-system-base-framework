import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { publicPackageDirectories, repositoryRoot } from './package-catalog.mjs';

const governanceFiles = [
  'LICENSE',
  'NOTICE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SUPPORT.md',
  'TRADEMARKS.md',
];

await Promise.all(governanceFiles.map((file) => access(path.join(repositoryRoot, file))));

for (const directory of publicPackageDirectories) {
  const manifestPath = path.join(repositoryRoot, directory, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.private, false, `${manifest.name} must be publishable`);
  assert.equal(manifest.license, 'Apache-2.0', `${manifest.name} must declare Apache-2.0`);
  assert.equal(
    manifest.publishConfig?.registry,
    'https://registry.npmjs.org',
    `${manifest.name} stable releases must target npmjs`,
  );
  assert.equal(manifest.publishConfig?.access, 'public', `${manifest.name} must publish publicly`);
  assert.equal(
    manifest.repository?.url,
    'git+https://github.com/LingcooTech/lingcoo-system-base-framework.git',
    `${manifest.name} must link to the public source repository`,
  );
}

console.log('Open-source governance and public package metadata verified.');
