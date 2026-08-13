import { FRAME_VERSION, type ExtensionManifest } from '@lingcootech/frame-extension-sdk';
import { frameIdentityAdminManifest } from '@lingcootech/frame-admin/manifest';
import { frameIdentityWebManifest } from '@lingcootech/frame-web/manifest';
import {
  SECURITY_PROVIDER_CAPABILITY,
  SECURITY_PROVIDER_CAPABILITY_VERSION,
} from '@lingcootech/frame-fastify/security';

import { defaultIdentityEnvironmentVariables } from './environment.js';
import { identityPermissions } from './rbac.js';

export const identityServerRoutes = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'GET', path: '/api/auth/me' },
  { method: 'POST', path: '/api/auth/change-password' },
  { method: 'POST', path: '/api/auth/password-reset/request' },
  { method: 'POST', path: '/api/auth/password-reset/complete' },
  { method: 'POST', path: '/api/auth/invitations/accept' },
  { method: 'POST', path: '/api/auth/email/verify' },
  { method: 'POST', path: '/api/account/email-verification' },
  { method: 'GET', path: '/api/account/profile' },
  { method: 'PATCH', path: '/api/account/profile' },
  { method: 'GET', path: '/api/account/sessions' },
  { method: 'DELETE', path: '/api/account/sessions/:sessionId' },
  { method: 'POST', path: '/api/account/sessions/revoke-others' },
  { method: 'GET', path: '/api/account/security-events' },
  { method: 'GET', path: '/api/access/accounts' },
  { method: 'POST', path: '/api/access/accounts' },
  { method: 'PATCH', path: '/api/access/accounts/:accountId' },
  { method: 'POST', path: '/api/access/accounts/:accountId/invitation' },
  { method: 'GET', path: '/api/access/roles' },
  { method: 'GET', path: '/api/access/permissions' },
  { method: 'POST', path: '/api/access/roles' },
  { method: 'PATCH', path: '/api/access/roles/:roleId' },
] as const;

/** Identity is optional and has no dependency on the legacy Frame feature bundle. */
export const frameIdentityManifest = {
  id: 'frame-identity',
  version: FRAME_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  capabilities: {
    server: {
      provides: [
        {
          id: SECURITY_PROVIDER_CAPABILITY,
          version: SECURITY_PROVIDER_CAPABILITY_VERSION,
        },
      ],
    },
  },
  environment: { variables: defaultIdentityEnvironmentVariables },
  permissions: identityPermissions,
  server: { routes: identityServerRoutes },
  migrations: {
    sourceId: 'frame-identity',
    migrations: [{ id: '0001_identity.sql' }],
  },
  admin: frameIdentityAdminManifest,
  web: frameIdentityWebManifest,
} as const satisfies ExtensionManifest;
