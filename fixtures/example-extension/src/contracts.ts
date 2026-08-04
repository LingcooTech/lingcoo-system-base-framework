import type { ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const exampleManifest = {
  id: 'example',
  version: '0.1.0',
  apiVersion: '1',
  frame: '^0.3.0',
  dependencies: [{ id: 'frame', version: '^0.3.0' }],
  permissions: ['example.read'],
  settings: ['example.greeting'],
  server: {
    routes: [{ method: 'GET', path: '/api/example' }],
  },
  worker: {
    jobs: ['example.echo'],
    subscriptions: ['example.created'],
  },
  migrations: {
    sourceId: 'example',
    migrations: [{ id: '0001_initial.sql', legacyAliases: ['0001_example_initial.sql'] }],
  },
} as const satisfies ExtensionManifest;
