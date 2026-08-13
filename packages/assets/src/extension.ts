import { defineExtension } from '@lingcootech/frame-extension-sdk';

import { frameAssetsManifest } from './manifest.js';
import { assetsMigrationExtension } from './migrations.js';
import type { AssetsPorts } from './ports.js';
import { createAssetsServerExtension, type AssetsPortsFactory } from './server.js';
import { createAssetsWorkerExtension, type AssetsWorkerPortsFactory } from './worker.js';

export function createAssetsExtension<TEnvironment = unknown>(
  options: {
    serverPorts?: AssetsPorts | AssetsPortsFactory;
    workerPorts?: AssetsPorts | AssetsWorkerPortsFactory<TEnvironment>;
  } = {},
) {
  return defineExtension({
    manifest: frameAssetsManifest,
    server: createAssetsServerExtension({ ports: options.serverPorts }),
    worker: createAssetsWorkerExtension<TEnvironment>({ ports: options.workerPorts }),
    migrations: assetsMigrationExtension,
  });
}

export const frameAssetsExtension = createAssetsExtension();
