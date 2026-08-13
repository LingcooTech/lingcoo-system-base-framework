import assert from 'node:assert/strict';
import test from 'node:test';
import { presentationManifest } from '../src/contracts.js';
import { presentationMigrationSource } from '../src/migrations.js';
import { createNoopPresentationProfileReader } from '../src/profile-reader.js';
test('Presentation owns its migration and public contract', () => {
  assert.equal(presentationManifest.id, 'frame-presentation');
  assert.equal(
    presentationMigrationSource.migrations[0]?.legacyAliases?.[0],
    '0008_presentation.sql',
  );
});

test('Presentation exposes a provider-neutral profile reader', async () => {
  assert.deepEqual(await createNoopPresentationProfileReader().get(), {
    displayName: 'Lingcoo Frame',
    publicUrl: null,
  });
});
