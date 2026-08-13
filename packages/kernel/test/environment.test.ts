import assert from 'node:assert/strict';
import test from 'node:test';

import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import { defineEnvironmentExtension } from '@lingcootech/frame-extension-sdk/environment';

import { createSystemEnvironmentRegistry } from '../src/index.js';

test('Kernel scopes extension environment without depending on a Host env type', () => {
  const extension = defineExtension({
    manifest: {
      id: 'environment-test',
      version: '1.0.0',
      apiVersion: '1',
      frame: FRAME_VERSION,
      environment: { variables: [{ name: 'TEST_SECRET', sensitive: true }] },
    },
    environment: defineEnvironmentExtension({
      variables: ['TEST_SECRET'],
      parse(source) {
        return { secret: source.TEST_SECRET };
      },
    }),
  });
  const system = defineSystem({
    id: 'environment-test-system',
    version: '1.0.0',
    extensions: [extension],
  });
  const registry = createSystemEnvironmentRegistry({
    system,
    source: { TEST_SECRET: 'scoped-secret', UNDECLARED: 'hidden' },
    nodeEnv: 'test',
  });

  assert.deepEqual(registry.require('environment-test'), { secret: 'scoped-secret' });
  assert.deepEqual(registry.describe(), [
    {
      extensionId: 'environment-test',
      variables: [{ name: 'TEST_SECRET', sensitive: true }],
    },
  ]);
});
