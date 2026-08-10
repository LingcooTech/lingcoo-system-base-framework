import assert from 'node:assert/strict';
import { test } from 'node:test';

import { domainManifest } from '../src/contracts.js';

test('domain manifest exposes a namespaced migration source', () => {
  assert.equal(domainManifest.migrations?.sourceId, '__SYSTEM_ID__-domain');
  assert.equal(domainManifest.server?.routes[0]?.path, '/api/domain/example');
});
