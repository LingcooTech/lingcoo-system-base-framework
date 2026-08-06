import type { ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const exampleManifest = {
  id: 'example',
  version: '0.1.0',
  apiVersion: '1',
  frame: '^0.6.0',
  dependencies: [{ id: 'frame', version: '^0.6.0' }],
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
  admin: {
    routes: [
      {
        id: 'example.overview',
        path: '/example/*',
        title: '示例扩展',
        description: '由扩展包贡献的后台页面。',
        permission: 'example.read',
      },
    ],
    navigation: [
      {
        id: 'example.overview',
        routeId: 'example.overview',
        href: '/example',
        label: '示例扩展',
        group: '扩展',
        order: 500,
      },
    ],
    dashboardWidgets: [
      { id: 'example.summary', title: '示例扩展状态', permission: 'example.read', order: 500 },
    ],
    searchProviders: [{ id: 'example.content', label: '示例扩展', permission: 'example.read' }],
    landingBlockEditors: [{ type: 'example.hero', label: '示例主视觉' }],
  },
  web: {
    routes: [{ id: 'example.public', path: '/example' }],
    seo: [{ id: 'example.public', routeId: 'example.public' }],
    sitemap: [{ id: 'example.public' }],
    landingBlocks: [{ type: 'example.hero', schemaVersion: 2 }],
  },
} as const satisfies ExtensionManifest;
