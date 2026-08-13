import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '@lingcootech/frame-database';
import { notificationDeliveries, notifications } from '@lingcootech/frame-database/schema';
import { createNoopNotificationsPorts, type NotificationsPorts } from './ports.js';

const payloadSchema = z.object({ deliveryId: z.uuid() });

export class NotificationDeliveryService {
  constructor(
    private readonly db: Database,
    private readonly ports: NotificationsPorts = createNoopNotificationsPorts(),
  ) {}

  async deliverEmail(payload: Record<string, unknown>) {
    const { deliveryId } = payloadSchema.parse(payload);
    const [row] = await this.db
      .select({ delivery: notificationDeliveries, notification: notifications })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(eq(notificationDeliveries.id, deliveryId))
      .limit(1);
    if (!row) throw new Error('Notification delivery does not exist');
    if (row.delivery.status === 'sent') return { deliveryId, alreadySent: true };
    if (!row.delivery.transportId) throw new Error('Mail transport is unavailable');
    await this.db
      .update(notificationDeliveries)
      .set({
        status: 'sending',
        attempts: row.delivery.attempts + 1,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.id, deliveryId));
    try {
      const result = await this.ports.mail.send({
        transportId: row.delivery.transportId,
        destination: row.delivery.destination,
        title: row.notification.title,
        body: row.notification.body,
        content: row.delivery.content,
      });
      await this.db
        .update(notificationDeliveries)
        .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
        .where(eq(notificationDeliveries.id, deliveryId));
      return { deliveryId, messageId: result.messageId };
    } catch (error) {
      await this.db
        .update(notificationDeliveries)
        .set({
          status: 'failed',
          lastError: (error instanceof Error ? error.message : '邮件投递失败').slice(0, 1000),
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveries.id, deliveryId));
      throw error;
    }
  }
}
