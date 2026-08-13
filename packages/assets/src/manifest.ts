import { frameAssetsAdminManifest } from '@lingcootech/frame-admin/manifest';
import { FRAME_VERSION, type ExtensionManifest } from '@lingcootech/frame-extension-sdk';

export const assetsPermissions = ['assets.read', 'assets.write', 'assets.manage'] as const;

export const assetsServerRoutes = [
  { method: 'GET', path: '/api/assets' },
  { method: 'GET', path: '/api/assets/summary' },
  { method: 'GET', path: '/api/assets/storage-connections' },
  { method: 'POST', path: '/api/assets/upload-intents' },
  { method: 'POST', path: '/api/assets/:assetId/complete' },
  { method: 'GET', path: '/api/assets/:assetId/access-url' },
  { method: 'PATCH', path: '/api/assets/:assetId' },
  { method: 'POST', path: '/api/assets/:assetId/archive' },
  { method: 'POST', path: '/api/assets/:assetId/restore' },
  { method: 'DELETE', path: '/api/assets/:assetId' },
  { method: 'GET', path: '/api/assets/:assetId/references' },
  { method: 'POST', path: '/api/assets/:assetId/references' },
  { method: 'DELETE', path: '/api/assets/:assetId/references/:referenceId' },
] as const;

export const frameAssetsManifest = {
  id: 'frame-assets',
  version: FRAME_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  dependencies: [
    { id: 'frame-identity', version: `^${FRAME_VERSION}` },
    { id: 'frame-jobs', version: `^${FRAME_VERSION}` },
  ],
  permissions: assetsPermissions,
  server: { routes: assetsServerRoutes },
  worker: { jobs: ['storage.asset.delete', 'storage.asset.expire-upload'] },
  migrations: { sourceId: 'frame-assets', migrations: [{ id: '0001_assets.sql' }] },
  admin: frameAssetsAdminManifest,
} as const satisfies ExtensionManifest;
