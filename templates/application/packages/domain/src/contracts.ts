import { FRAME_VERSION, type ExtensionManifest } from '@lingcootech/frame-extension-sdk';

export const domainManifest = {
  id: '__SYSTEM_ID__-domain',
  version: '0.1.0',
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
  permissions: ['domain.read'],
  settings: ['domain.greeting'],
  server: { routes: [{ method: 'GET', path: '/api/domain/example' }] },
  worker: { jobs: ['domain.echo'] },
  migrations: {
    sourceId: '__SYSTEM_ID__-domain',
    migrations: [{ id: '0001_initial.sql' }],
  },
  admin: {
    routes: [
      {
        id: 'domain.overview',
        path: '/',
        title: '__DISPLAY_NAME__',
        description: 'Application domain overview.',
        permission: 'domain.read',
      },
    ],
    navigation: [
      {
        id: 'domain.overview',
        routeId: 'domain.overview',
        href: '/',
        label: '业务概览',
        group: '业务',
        order: 10,
      },
    ],
  },
  // <web>
  web: {
    routes: [{ id: 'domain.home', path: '/' }],
    seo: [{ id: 'domain.home', routeId: 'domain.home' }],
    sitemap: [{ id: 'domain.home' }],
  },
  // </web>
} as const satisfies ExtensionManifest;
