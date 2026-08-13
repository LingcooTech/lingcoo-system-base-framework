import { FRAME_VERSION, type ExtensionManifest } from '@lingcootech/frame-extension-sdk';
import type { AuditCommandPort } from '@lingcootech/frame-audit';
import type { Database } from '@lingcootech/frame-database';
import type { IdentityAccountDirectoryPort } from '@lingcootech/frame-identity';

export type PresentationTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const presentationManifest = {
  id: 'frame-presentation',
  version: FRAME_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
  permissions: ['presentation.read', 'presentation.write'],
  server: {
    routes: [
      { method: 'GET', path: '/api/public/presentation' },
      { method: 'GET', path: '/api/presentation' },
      { method: 'GET', path: '/api/presentation/history' },
      { method: 'PATCH', path: '/api/presentation' },
      { method: 'GET', path: '/robots.txt' },
      { method: 'GET', path: '/sitemap.xml' },
    ],
  },
  migrations: { sourceId: 'frame-presentation', migrations: [{ id: '0001_presentation.sql' }] },
  admin: {
    routes: [
      {
        id: 'frame-presentation.settings',
        path: '/presentation/*',
        title: '品牌与站点呈现',
        description: '管理系统标识、品牌色、联系方式和站点呈现。',
        permission: 'presentation.read',
      },
    ],
  },
} as const satisfies ExtensionManifest;

export type PresentationAsset = {
  id: string;
  displayName: string;
  publicUrl: string | null;
  mimeType?: string | null;
};
export interface PresentationAssetsPort {
  load(ids: readonly string[]): Promise<readonly PresentationAsset[]>;
  validatePublicImages(ids: readonly string[]): Promise<boolean>;
  replaceReferences(
    transaction: PresentationTransaction,
    input: {
      ownerType: string;
      ownerId: string;
      fields: Record<string, string | null>;
      actorId: string;
    },
  ): Promise<void>;
}
export interface PresentationPorts {
  accounts: IdentityAccountDirectoryPort;
  assets: PresentationAssetsPort;
  audit: AuditCommandPort;
}
