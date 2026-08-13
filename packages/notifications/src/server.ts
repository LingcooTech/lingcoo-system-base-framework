import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FrameFastifyInstance } from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';

import { createNoopNotificationsPorts, type NotificationsPorts } from './ports.js';
import { registerNotificationsRoutes } from './routes.js';

export type NotificationsPortsFactory = (
  app: FastifyInstance,
) => NotificationsPorts | Promise<NotificationsPorts>;

export function createNotificationsServerExtension(
  options: { ports?: NotificationsPorts | NotificationsPortsFactory } = {},
) {
  return defineServerExtension<FrameFastifyInstance>({
    async register({ app }) {
      const configured = options.ports ?? createNoopNotificationsPorts();
      const ports = typeof configured === 'function' ? await configured(app) : configured;
      registerNotificationsRoutes(app, { ports });
    },
  });
}

export { registerNotificationsRoutes } from './routes.js';
