import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FrameFastifyInstance } from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';

import { createNoopJobsPorts, type JobsPorts } from './ports.js';
import { registerJobsRoutes } from './routes.js';

export type JobsPortsFactory = (app: FastifyInstance) => JobsPorts | Promise<JobsPorts>;

export function createJobsServerExtension(
  options: {
    ports?: JobsPorts | JobsPortsFactory;
  } = {},
) {
  return defineServerExtension<FrameFastifyInstance>({
    async register({ app }) {
      const configured = options.ports ?? createNoopJobsPorts();
      const ports = typeof configured === 'function' ? await configured(app) : configured;
      registerJobsRoutes(app, { ports });
    },
  });
}

export { registerJobsRoutes } from './routes.js';
