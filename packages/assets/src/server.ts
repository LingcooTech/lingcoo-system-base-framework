import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FrameFastifyInstance } from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';

import { createNoopAssetsPorts, type AssetsPorts } from './ports.js';
import { registerAssetsRoutes } from './routes.js';

export type AssetsPortsFactory = (app: FastifyInstance) => AssetsPorts | Promise<AssetsPorts>;

export function createAssetsServerExtension(
  options: { ports?: AssetsPorts | AssetsPortsFactory } = {},
) {
  return defineServerExtension<FrameFastifyInstance>({
    async register({ app }) {
      const configured = options.ports ?? createNoopAssetsPorts();
      const ports = typeof configured === 'function' ? await configured(app) : configured;
      registerAssetsRoutes(app, { ports });
    },
  });
}

export { registerAssetsRoutes } from './routes.js';
