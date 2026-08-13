import { frameIntegrationsAdminManifest } from '@lingcootech/frame-admin/manifest';
import {
  FRAME_VERSION,
  type ExtensionManifest,
  type ExtensionRouteDeclaration,
} from '@lingcootech/frame-extension-sdk';
import { integrationsEnvironmentVariables } from './environment.js';

export const integrationsPermissions = ['integrations.read', 'integrations.write'] as const;

export const integrationsServerRoutes = [
  { method: 'GET', path: '/api/integrations/providers' },
  { method: 'GET', path: '/api/integrations/connections' },
  { method: 'POST', path: '/api/integrations/connections' },
  { method: 'PATCH', path: '/api/integrations/connections/:connectionId' },
  { method: 'POST', path: '/api/integrations/connections/:connectionId/test' },
  { method: 'GET', path: '/api/integrations/connections/:connectionId/events' },
] as const satisfies readonly ExtensionRouteDeclaration[];

export function createIntegrationsManifest(
  additionalRoutes: readonly ExtensionRouteDeclaration[] = [],
): ExtensionManifest {
  return {
    id: 'frame-integrations',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
    environment: { variables: integrationsEnvironmentVariables },
    permissions: integrationsPermissions,
    server: { routes: [...integrationsServerRoutes, ...additionalRoutes] },
    migrations: {
      sourceId: 'frame-integrations',
      migrations: [{ id: '0001_integrations.sql' }],
    },
    admin: frameIntegrationsAdminManifest,
  };
}

export const frameIntegrationsManifest = createIntegrationsManifest();
