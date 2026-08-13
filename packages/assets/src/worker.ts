import type { Database } from '@lingcootech/frame-database';
import {
  defineWorkerExtension,
  type WorkerExtensionContext,
} from '@lingcootech/frame-extension-sdk/worker';

import { createNoopAssetsPorts, type AssetsPorts } from './ports.js';
import { assetDeleteJobPayloadSchema } from './schemas.js';
import { AssetService } from './service.js';

export type AssetsWorkerPortsFactory<TEnvironment = unknown> = (
  context: WorkerExtensionContext<TEnvironment, Database>,
) => AssetsPorts;

export function createAssetsWorkerExtension<TEnvironment = unknown>(
  options: { ports?: AssetsPorts | AssetsWorkerPortsFactory<TEnvironment> } = {},
) {
  return defineWorkerExtension<TEnvironment, Database>({
    register(context) {
      const configured = options.ports ?? createNoopAssetsPorts();
      const ports = typeof configured === 'function' ? configured(context) : configured;
      const service = new AssetService(context.database, ports);
      context.registerJob('storage.asset.delete', ({ payload }) =>
        service.executeDelete(assetDeleteJobPayloadSchema.parse(payload).assetId),
      );
      context.registerJob('storage.asset.expire-upload', ({ payload }) =>
        service.expireUpload(assetDeleteJobPayloadSchema.parse(payload).assetId),
      );
    },
  });
}
