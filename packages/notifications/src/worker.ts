import type { Database } from '@lingcootech/frame-database';
import {
  defineWorkerExtension,
  type WorkerExtensionContext,
} from '@lingcootech/frame-extension-sdk/worker';

import { NotificationDeliveryService } from './delivery.js';
import { createPasswordChangedSubscriber } from './policies.js';
import { createNoopNotificationsPorts, type NotificationsPorts } from './ports.js';
import { NotificationService } from './service.js';

export type NotificationsWorkerPortsFactory<TEnvironment = unknown> = (
  context: WorkerExtensionContext<TEnvironment, Database>,
) => NotificationsPorts;

export function createNotificationsWorkerExtension<TEnvironment = unknown>(
  options: {
    ports?: NotificationsPorts | NotificationsWorkerPortsFactory<TEnvironment>;
  } = {},
) {
  return defineWorkerExtension<TEnvironment, Database>({
    register(context) {
      const configured = options.ports ?? createNoopNotificationsPorts();
      const ports = typeof configured === 'function' ? configured(context) : configured;
      const notifications = new NotificationService(context.database, ports);
      const delivery = new NotificationDeliveryService(context.database, ports);
      context.registerJob('notification.email.deliver', ({ payload }) =>
        delivery.deliverEmail(payload),
      );
      context.subscribe('auth.password_changed', createPasswordChangedSubscriber(notifications));
    },
  });
}

export { NotificationDeliveryService } from './delivery.js';
export { createPasswordChangedSubscriber } from './policies.js';
export {
  NotificationService,
  type CreateNotificationInput,
  type NotificationLevel,
} from './service.js';
