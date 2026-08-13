import { defineExtension } from '@lingcootech/frame-extension-sdk';
import { presentationManifest } from './contracts.js';
import { presentationMigrationExtension } from './migrations.js';
import { createPresentationServerExtension, type PresentationPortsFactory } from './server.js';
import type { PresentationPorts } from './contracts.js';
import { createNoopIdentityAccountDirectory } from '@lingcootech/frame-identity';

function noopPorts(): PresentationPorts {
  return {
    accounts: createNoopIdentityAccountDirectory(),
    audit: { async record() {} },
    assets: {
      async load() {
        return [];
      },
      async validatePublicImages() {
        return false;
      },
      async replaceReferences() {},
    },
  };
}
export function createPresentationExtension(options: {
  ports: PresentationPorts | PresentationPortsFactory;
}) {
  return defineExtension({
    manifest: presentationManifest,
    server: createPresentationServerExtension({ ports: options.ports }),
    migrations: presentationMigrationExtension,
  });
}
export const framePresentationExtension = createPresentationExtension({ ports: noopPorts() });
