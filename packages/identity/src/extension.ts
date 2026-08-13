import { defineExtension } from '@lingcootech/frame-extension-sdk';
import type { MigrationExtensionSurface } from '@lingcootech/frame-extension-sdk/migrations';
import type {
  ServerApplication,
  ServerExtensionSurface,
} from '@lingcootech/frame-extension-sdk/server';

import { defaultIdentityEnvironment } from './environment.js';
import { frameIdentityManifest } from './manifest.js';
import { identityMigrationExtension } from './migrations.js';
import type { IdentityPorts } from './ports.js';
import { createIdentityServerExtension, type IdentityPortsFactory } from './server.js';

export interface CreateIdentityExtensionOptions<TApp = ServerApplication> {
  server?: ServerExtensionSurface<TApp>;
  migrations?: MigrationExtensionSurface;
  environmentId?: string;
  ports?: IdentityPorts | IdentityPortsFactory;
}

/** Compose Identity with an application-selected HTTP/storage implementation. */
export function createIdentityExtension<TApp = ServerApplication>(
  options: CreateIdentityExtensionOptions<TApp> = {},
) {
  return defineExtension({
    manifest: frameIdentityManifest,
    environment: defaultIdentityEnvironment,
    server:
      options.server ??
      (createIdentityServerExtension({
        environmentId: options.environmentId,
        ports: options.ports,
      }) as ServerExtensionSurface<TApp>),
    migrations: options.migrations ?? identityMigrationExtension,
  });
}

export const frameIdentityExtension = createIdentityExtension();
