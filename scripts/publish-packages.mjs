import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { publicPackageDirectories, repositoryRoot } from './package-catalog.mjs';

const distTag = process.argv[2] ?? 'preview';
if (!/^[a-z][a-z0-9._-]*$/i.test(distTag)) throw new Error(`Invalid npm dist-tag: ${distTag}`);

const registry = 'https://npm.pkg.github.com';
for (const directory of publicPackageDirectories) {
  const packageDirectory = path.join(repositoryRoot, directory);
  const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'));
  const packageVersion = `${manifest.name}@${manifest.version}`;
  const existing = spawnSync('npm', ['view', packageVersion, 'version', '--registry', registry], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (existing.status === 0) {
    console.log(`Skipping existing ${packageVersion}.`);
    continue;
  }

  console.log(`Publishing ${packageVersion} with dist-tag ${distTag}.`);
  const published = spawnSync(
    'npm',
    ['publish', '--tag', distTag, '--access', 'restricted', '--registry', registry],
    { cwd: packageDirectory, stdio: 'inherit' },
  );
  if (published.status !== 0) process.exit(published.status ?? 1);
}
