import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import {
  SECURITY_PROVIDER_CAPABILITY,
  type FrameFastifyInstance,
} from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';

import { registerIdentityAccessRoutes } from './access-routes.js';
import { registerIdentityAuthRoutes } from './auth-routes.js';
import { DEFAULT_IDENTITY_ENVIRONMENT_ID } from './environment.js';
import { createNoopIdentityPorts, type IdentityPorts } from './ports.js';
import { createCookieSessionSecurityProvider } from './provider.js';

export type IdentityPortsFactory = (app: FastifyInstance) => IdentityPorts | Promise<IdentityPorts>;

export interface CreateIdentityServerOptions {
  environmentId?: string;
  ports?: IdentityPorts | IdentityPortsFactory;
}

function isPortsFactory(
  value: IdentityPorts | IdentityPortsFactory,
): value is IdentityPortsFactory {
  return typeof value === 'function';
}

export function createIdentityServerExtension(options: CreateIdentityServerOptions = {}) {
  const environmentId = options.environmentId ?? DEFAULT_IDENTITY_ENVIRONMENT_ID;
  return defineServerExtension<FrameFastifyInstance>({
    capabilities: [
      {
        id: SECURITY_PROVIDER_CAPABILITY,
        value: createCookieSessionSecurityProvider(environmentId),
      },
    ],
    async register({ app }) {
      const configured = options.ports ?? createNoopIdentityPorts();
      const ports = isPortsFactory(configured) ? await configured(app) : configured;
      await registerIdentityAuthRoutes(app, { environmentId, ports });
      registerIdentityAccessRoutes(app, { ports });
    },
  });
}

export { AccessService } from './access-service.js';
export {
  AccountSecurityService,
  type SecurityChallengePurpose,
} from './account-security-service.js';
export { AuthService, type SessionMetadata } from './auth-service.js';
export { registerIdentityAccessRoutes } from './access-routes.js';
export { registerIdentityAuthRoutes } from './auth-routes.js';
