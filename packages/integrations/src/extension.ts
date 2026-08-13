import { defineExtension, type ExtensionRouteDeclaration } from '@lingcootech/frame-extension-sdk';
import { integrationsEnvironment } from './environment.js';
import { createIntegrationsManifest } from './manifest.js';
import { integrationsMigrationExtension } from './migrations.js';
import {
  createIntegrationsServerExtension,
  type CreateIntegrationsServerOptions,
} from './server.js';

export function createIntegrationsExtension(
  options: CreateIntegrationsServerOptions & {
    additionalRoutes?: readonly ExtensionRouteDeclaration[];
  } = {},
) {
  return defineExtension({
    manifest: createIntegrationsManifest(options.additionalRoutes),
    environment: integrationsEnvironment,
    server: createIntegrationsServerExtension(options),
    migrations: integrationsMigrationExtension,
  });
}

export const frameIntegrationsExtension = createIntegrationsExtension();
