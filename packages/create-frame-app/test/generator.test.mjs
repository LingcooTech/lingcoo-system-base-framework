import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createApplication,
  upgradeApplication,
  verifyApplicationVersions,
} from '../src/generator.mjs';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const templateDirectory = path.join(repositoryRoot, 'templates/application');

test('creates deterministic application metadata and feature selection', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'frame-generator-'));
  const target = path.join(temporaryRoot, 'example-app');
  try {
    await createApplication({
      cms: false,
      directory: target,
      displayName: 'Example App',
      frameVersion: '0.7.2',
      install: false,
      packageScope: '@example',
      registry: 'github',
      systemId: 'example-app',
      templateDirectory,
      web: false,
    });
    const config = JSON.parse(await readFile(path.join(target, 'lingcootech.frame.json'), 'utf8'));
    assert.deepEqual(config.features, { cms: false, web: false });
    await assert.rejects(() => readFile(path.join(target, 'apps/web/package.json'), 'utf8'));
    assert.match(await readFile(path.join(target, '.npmrc'), 'utf8'), /npm\.pkg\.github\.com/);
    const environmentExample = await readFile(path.join(target, '.env.example'), 'utf8');
    assert.match(environmentExample, /^AUTH_JWT_SECRET=$/m);
    assert.match(environmentExample, /^AUTH_BOOTSTRAP_PASSWORD=$/m);
    assert.doesNotMatch(environmentExample, /^JWT_SECRET=/m);
    assert.doesNotMatch(environmentExample, /owner@example\.com/);
    assert.doesNotMatch(
      await readFile(path.join(target, 'apps/system/src/system.ts'), 'utf8'),
      /frameCmsExtension/,
    );
    await verifyApplicationVersions(target);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('upgrade changes every Frame dependency and rejects mixed versions', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'frame-upgrade-'));
  try {
    await mkdir(path.join(temporaryRoot, 'apps/system'), { recursive: true });
    await writeFile(
      path.join(temporaryRoot, 'lingcootech.frame.json'),
      `${JSON.stringify({ schemaVersion: 1, frameVersion: '0.7.1' })}\n`,
    );
    await writeFile(
      path.join(temporaryRoot, 'apps/system/package.json'),
      `${JSON.stringify({
        dependencies: { '@lingcootech/frame': '0.7.1' },
        devDependencies: { '@lingcootech/create-frame-app': '0.7.1' },
      })}\n`,
    );
    await upgradeApplication({
      directory: temporaryRoot,
      lockfile: false,
      targetVersion: '0.7.2',
    });
    await verifyApplicationVersions(temporaryRoot);
    const manifest = JSON.parse(
      await readFile(path.join(temporaryRoot, 'apps/system/package.json'), 'utf8'),
    );
    assert.equal(manifest.dependencies['@lingcootech/frame'], '0.7.2');
    assert.equal(manifest.devDependencies['@lingcootech/create-frame-app'], '0.7.2');
    manifest.dependencies['@lingcootech/frame'] = '0.7.1';
    await writeFile(
      path.join(temporaryRoot, 'apps/system/package.json'),
      `${JSON.stringify(manifest)}\n`,
    );
    await assert.rejects(() => verifyApplicationVersions(temporaryRoot), /must all match 0\.7\.2/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
