import { defineExtension } from '@lingcootech/frame-extension-sdk';

import { frameNotificationsManifest } from './manifest.js';
import { notificationsMigrationExtension } from './migrations.js';
import type { NotificationsPorts } from './ports.js';
import { createNotificationsServerExtension, type NotificationsPortsFactory } from './server.js';
import {
  createNotificationsWorkerExtension,
  type NotificationsWorkerPortsFactory,
} from './worker.js';

export function createNotificationsExtension<TEnvironment = unknown>(
  options: {
    serverPorts?: NotificationsPorts | NotificationsPortsFactory;
    workerPorts?: NotificationsPorts | NotificationsWorkerPortsFactory<TEnvironment>;
  } = {},
) {
  return defineExtension({
    manifest: frameNotificationsManifest,
    server: createNotificationsServerExtension({ ports: options.serverPorts }),
    worker: createNotificationsWorkerExtension<TEnvironment>({ ports: options.workerPorts }),
    migrations: notificationsMigrationExtension,
  });
}

export const frameNotificationsExtension = createNotificationsExtension();
