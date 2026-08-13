import assert from 'node:assert/strict';
import test from 'node:test';

import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';

import {
  assertSystemCompatibility,
  frameKernelSystem,
  registerSystemServerExtensions,
} from '../src/index.js';

test('Kernel system has no product extensions', () => {
  assert.deepEqual(frameKernelSystem.extensions, []);
  assert.doesNotThrow(() => assertSystemCompatibility(frameKernelSystem));
});

test('extension engine registers declared routes through a host port', async () => {
  const routes = new Set<string>();
  const app = {
    get(path: string) {
      routes.add(`GET ${path}`);
    },
  };
  const extension = defineExtension({
    manifest: {
      id: 'kernel-test',
      version: '1.0.0',
      apiVersion: '1',
      frame: FRAME_VERSION,
      server: { routes: [{ method: 'GET', path: '/test' }] },
    },
    server: defineServerExtension<typeof app>({
      register({ app: hostApp }) {
        hostApp.get('/test');
      },
    }),
  });
  const system = defineSystem({
    id: 'kernel-test-system',
    version: '1.0.0',
    extensions: [extension],
  });

  await registerSystemServerExtensions(
    {
      app,
      hasRoute(method, path) {
        return routes.has(`${method} ${path}`);
      },
    },
    system,
  );
  assert.equal(routes.has('GET /test'), true);
});
