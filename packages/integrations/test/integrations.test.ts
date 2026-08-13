import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNoopIntegrationsPorts,
  frameIntegrationsManifest,
  IntegrationProviderRegistry,
  validateProviderFields,
} from '../src/index.js';

test('Integrations owns provider-neutral routes and migration without vendor SDKs', () => {
  assert.equal(frameIntegrationsManifest.id, 'frame-integrations');
  assert.equal(frameIntegrationsManifest.server?.routes.length, 6);
  assert.equal(frameIntegrationsManifest.migrations?.sourceId, 'frame-integrations');
  const registry = new IntegrationProviderRegistry();
  assert.deepEqual(registry.list(), []);
});

test('Provider contracts reject unknown and invalid fields', () => {
  const fields = [{ key: 'endpoint', label: 'Endpoint', type: 'url' as const, required: true }];
  assert.throws(() => validateProviderFields(fields, { endpoint: 'ftp://invalid' }, '配置'));
  assert.throws(() =>
    validateProviderFields(fields, { endpoint: 'https://valid', extra: 1 }, '配置'),
  );
  assert.doesNotThrow(() => validateProviderFields(fields, { endpoint: 'https://valid' }, '配置'));
});

test('No-op Integrations exposes an empty connection query boundary', async () => {
  const connections = createNoopIntegrationsPorts().connections;
  assert.deepEqual(await connections.listEnabled('smtp'), []);
  assert.equal(await connections.resolveEnabled('smtp'), null);
  assert.deepEqual(await connections.search('mail', 10), []);
});
