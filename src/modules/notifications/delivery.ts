import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../../db/client.js';
import { notificationDeliveries, notifications } from '../../db/schema.js';
import { decryptSetting } from '../../lib/settings-crypto.js';
import type { IntegrationService } from '../integrations/service.js';
import { SmtpService } from '../integrations/providers/smtp-service.js';

const payloadSchema = z.object({ deliveryId: z.uuid() });

export class NotificationDeliveryService {
  private readonly smtp: SmtpService;

  constructor(
    private readonly db: Database,
    integrations: IntegrationService,
    private readonly encryptionKey?: string,
  ) {
    this.smtp = new SmtpService(integrations);
  }

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
    if (!row.delivery.integrationConnectionId) throw new Error('SMTP connection is unavailable');
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
      const content = row.delivery.encryptedContent
        ? decryptSetting<{ subject: string; text: string; html?: string }>(
            row.delivery.encryptedContent,
            this.encryptionKey ?? '',
          )
        : null;
      const result = await this.smtp.send(
        row.delivery.integrationConnectionId,
        {
          to: row.delivery.destination,
          subject: content?.subject ?? row.notification.title,
          text: content?.text ?? row.notification.body,
          html:
            content?.html ??
            `<div style="font-family:Arial,sans-serif;line-height:1.7;white-space:pre-wrap;">${escapeHtml(row.notification.body)}</div>`,
        },
        { operation: 'notification.email.deliver' },
      );
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
