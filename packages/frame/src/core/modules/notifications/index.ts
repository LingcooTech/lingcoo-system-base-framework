import type { AppModule } from '../types.js';
import {
  adminNotificationListSchema,
  announcementSchema,
  deliveryListSchema,
  notificationListSchema,
  notificationParamsSchema,
} from './schemas.js';
import { NotificationService } from './service.js';

export const notificationsModule: AppModule = {
  name: 'notifications',
  register(app) {
    const service = new NotificationService(app.db);
    app.get('/api/notifications/me', { preHandler: app.authenticate }, async (request) =>
      service.listForAccount(request.auth!.accountId, notificationListSchema.parse(request.query)),
    );
    app.get(
      '/api/notifications/me/unread-count',
      { preHandler: app.authenticate },
      async (request) => ({ unreadCount: await service.unreadCount(request.auth!.accountId) }),
    );
    app.post(
      '/api/notifications/:notificationId/read',
      { preHandler: app.authenticate },
      async (request) => {
        const { notificationId } = notificationParamsSchema.parse(request.params);
        return { notification: await service.markRead(notificationId, request.auth!.accountId) };
      },
    );
    app.post('/api/notifications/read-all', { preHandler: app.authenticate }, async (request) => ({
      updated: await service.markAllRead(request.auth!.accountId),
    }));
    app.post(
      '/api/notifications/:notificationId/archive',
      { preHandler: app.authenticate },
      async (request) => {
        const { notificationId } = notificationParamsSchema.parse(request.params);
        return { notification: await service.archive(notificationId, request.auth!.accountId) };
      },
    );
    app.get(
      '/api/notifications/admin',
      { preHandler: app.requirePermission('notifications.read') },
      async (request) => service.listAdmin(adminNotificationListSchema.parse(request.query)),
    );
    app.get(
      '/api/notifications/deliveries',
      { preHandler: app.requirePermission('notifications.read') },
      async (request) => service.listDeliveries(deliveryListSchema.parse(request.query)),
    );
    app.post(
      '/api/notifications/announcements',
      {
        preHandler: app.requirePermission('notifications.manage'),
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const result = await service.publishAnnouncement(
          announcementSchema.parse(request.body),
          request.auth!.accountId,
        );
        return reply.code(201).send({ result });
      },
    );
  },
};
