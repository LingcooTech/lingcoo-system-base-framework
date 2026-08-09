import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { publicPackageDirectories, repositoryRoot } from './package-catalog.mjs';

const channel = process.argv[2] ?? 'preview';
const distributions = Object.freeze({
  canary: {
    access: 'restricted',
    distTag: 'canary',
    registry: 'https://npm.pkg.github.com',
  },
  preview: {
    access: 'restricted',
    distTag: 'preview',
    registry: 'https://npm.pkg.github.com',
  },
  stable: {
    access: 'public',
    distTag: 'latest',
    registry: 'https://registry.npmjs.org',
  },
});

const distribution = distributions[channel];
if (!distribution) {
  throw new Error(`Unsupported release channel: ${channel}. Expected canary, preview, or stable.`);
}

const { access, distTag, registry } = distribution;
console.log(`Release channel ${channel}: ${registry} with dist-tag ${distTag} (${access}).`);
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
  const publishArguments = [
    'publish',
    '--tag',
    distTag,
    '--access',
    access,
    '--registry',
    registry,
  ];
  if (channel === 'stable') publishArguments.push('--provenance');
  const published = spawnSync('npm', publishArguments, {
    cwd: packageDirectory,
    stdio: 'inherit',
  });
  if (published.status !== 0) process.exit(published.status ?? 1);
}
