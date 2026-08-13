import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assetsMigrationSource,
  assetsServerRoutes,
  classifyMediaKind,
  frameAssetsManifest,
  safeObjectFilename,
} from '../src/index.js';

test('Assets owns its routes, worker jobs and migration source', () => {
  assert.equal(frameAssetsManifest.id, 'frame-assets');
  assert.equal(assetsServerRoutes.length, 13);
  assert.deepEqual(frameAssetsManifest.worker.jobs, [
    'storage.asset.delete',
    'storage.asset.expire-upload',
  ]);
  assert.equal(assetsMigrationSource.id, 'frame-assets');
  assert.match(assetsMigrationSource.migrations[0]!.sql, /CREATE TABLE "storage_assets"/);
});

test('asset filenames and media kinds stay provider-neutral', () => {
  assert.equal(safeObjectFilename('../../课程 封面 01.PNG'), '01.png');
  assert.equal(classifyMediaKind('image/png', 'file.bin'), 'image');
  assert.equal(classifyMediaKind('application/pdf', 'file.bin'), 'document');
  assert.equal(classifyMediaKind('application/octet-stream', 'bundle.zip'), 'archive');
});

test('Assets feature does not import Frame, Integrations, Jobs tables or Qiniu', async () => {
  const source = await Promise.all(
    [
      'service.ts',
      'ports.ts',
      'routes.ts',
      'server.ts',
      'worker.ts',
      'extension.ts',
      'manifest.ts',
    ].map((file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')),
  );
  assert.equal(/@lingcootech\/frame(?:['/"])/.test(source.join('\n')), false);
  assert.equal(/integrationConnections|jobRuns|Qiniu/i.test(source.join('\n')), false);
});
