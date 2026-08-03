import { and, count, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  accounts,
  integrationConnections,
  jobRuns,
  notificationDeliveries,
  notifications,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import type { EncryptedSetting } from '../../lib/settings-crypto.js';

type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface CreateNotificationInput {
  recipientAccountId: string;
  category: string;
  level?: NotificationLevel;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  sourceEventId?: string;
  sourceEventName?: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
  email?: { connectionId?: string; encryptedContent?: EncryptedSetting };
}

export class NotificationService {
  constructor(private readonly db: Database) {}

  async create(input: CreateNotificationInput) {
    return this.db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(notifications)
        .values({
          recipientAccountId: input.recipientAccountId,
          category: input.category,
          level: input.level ?? 'info',
          title: input.title,
          body: input.body,
          ctaLabel: input.ctaLabel,
          ctaUrl: input.ctaUrl,
          sourceEventId: input.sourceEventId,
          sourceEventName: input.sourceEventName,
          dedupeKey: input.dedupeKey,
          metadata: input.metadata ?? {},
        })
        .onConflictDoNothing({ target: notifications.dedupeKey })
        .returning();
      if (!created) {
        const [existing] = await transaction
          .select()
          .from(notifications)
          .where(eq(notifications.dedupeKey, input.dedupeKey))
          .limit(1);
        return existing;
      }

      if (input.email) {
        const [account] = await transaction
          .select({ email: accounts.email })
          .from(accounts)
          .where(eq(accounts.id, input.recipientAccountId))
          .limit(1);
        let connectionId = input.email.connectionId;
        if (!connectionId) {
          const [connection] = await transaction
            .select({ id: integrationConnections.id })
            .from(integrationConnections)
            .where(
              and(
                eq(integrationConnections.providerCode, 'smtp'),
                eq(integrationConnections.enabled, true),
              ),
            )
            .orderBy(desc(integrationConnections.updatedAt))
            .limit(1);
          connectionId = connection?.id;
        }
        if (account && connectionId) {
          const [delivery] = await transaction
            .insert(notificationDeliveries)
            .values({
              notificationId: created.id,
              channel: 'email',
              destination: account.email,
              integrationConnectionId: connectionId,
              encryptedContent: input.email.encryptedContent,
            })
            .returning({ id: notificationDeliveries.id });
          const [job] = await transaction
            .insert(jobRuns)
            .values({
              queue: 'notifications',
              kind: 'notification.email.deliver',
              payload: { deliveryId: delivery.id },
              dedupeKey: `notification-email:${created.id}`,
              relatedEntityType: 'notification',
              relatedEntityId: created.id,
              maxAttempts: 5,
            })
            .returning({ id: jobRuns.id });
          await transaction
            .update(notificationDeliveries)
            .set({ jobId: job.id, updatedAt: new Date() })
            .where(eq(notificationDeliveries.id, delivery.id));
        }
      }
      return created;
    });
  }

  async listForAccount(
    accountId: string,
    input: { limit: number; offset: number; status?: string; category?: string },
  ) {
    const filters = [eq(notifications.recipientAccountId, accountId)];
    if (input.status) filters.push(eq(notifications.status, input.status));
    if (input.category) filters.push(eq(notifications.category, input.category));
    const where = and(...filters);
    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ count: count() }).from(notifications).where(where),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }

  async listAdmin(input: {
    limit: number;
    offset: number;
    status?: string;
    category?: string;
    search?: string;
  }) {
    const filters = [];
    if (input.status) filters.push(eq(notifications.status, input.status));
    if (input.category) filters.push(eq(notifications.category, input.category));
    if (input.search) {
      const pattern = `%${input.search}%`;
      filters.push(
        or(
          ilike(notifications.title, pattern),
          ilike(notifications.body, pattern),
          ilike(accounts.email, pattern),
          ilike(accounts.displayName, pattern),
        )!,
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const [items, totalResult] = await Promise.all([
      this.db
        .select({
          notification: notifications,
          email: accounts.email,
          displayName: accounts.displayName,
        })
        .from(notifications)
        .innerJoin(accounts, eq(accounts.id, notifications.recipientAccountId))
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ count: count() })
        .from(notifications)
        .innerJoin(accounts, eq(accounts.id, notifications.recipientAccountId))
        .where(where),
    ]);
    return {
      items: items.map((item) => ({
        ...item.notification,
        recipient: { email: item.email, displayName: item.displayName },
      })),
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async unreadCount(accountId: string) {
    const [result] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.recipientAccountId, accountId), eq(notifications.status, 'unread')),
      );
    return Number(result?.count ?? 0);
  }

  async markRead(notificationId: string, accountId: string) {
    const [updated] = await this.db
      .update(notifications)
      .set({ status: 'read', readAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(notifications.id, notificationId), eq(notifications.recipientAccountId, accountId)),
      )
      .returning();
    if (!updated) throw httpError(404, '通知不存在', 'NotFoundError');
    return updated;
  }

  async markAllRead(accountId: string) {
    const updated = await this.db
      .update(notifications)
      .set({ status: 'read', readAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(notifications.recipientAccountId, accountId), eq(notifications.status, 'unread')),
      )
      .returning({ id: notifications.id });
    return updated.length;
  }

  async archive(notificationId: string, accountId: string) {
    const [updated] = await this.db
      .update(notifications)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(notifications.id, notificationId), eq(notifications.recipientAccountId, accountId)),
      )
      .returning();
    if (!updated) throw httpError(404, '通知不存在', 'NotFoundError');
    return updated;
  }

  async publishAnnouncement(
    input: {
      title: string;
      body: string;
      level: NotificationLevel;
      ctaLabel?: string;
      ctaUrl?: string;
      sendEmail: boolean;
      smtpConnectionId?: string;
    },
    actorId: string,
  ) {
    let smtpConnectionId = input.smtpConnectionId;
    if (input.sendEmail) {
      const [connection] = await this.db
        .select({ id: integrationConnections.id })
        .from(integrationConnections)
        .where(
          and(
            ...(smtpConnectionId ? [eq(integrationConnections.id, smtpConnectionId)] : []),
            eq(integrationConnections.providerCode, 'smtp'),
            eq(integrationConnections.enabled, true),
          ),
        )
        .orderBy(desc(integrationConnections.updatedAt))
        .limit(1);
      if (!connection) throw httpError(422, '没有可用的 SMTP 连接', 'ValidationError');
      smtpConnectionId = connection.id;
    }
    const recipients = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.status, 'active'));
    const broadcastId = crypto.randomUUID();
    for (const recipient of recipients) {
      await this.create({
        recipientAccountId: recipient.id,
        category: 'announcement',
        level: input.level,
        title: input.title,
        body: input.body,
        ctaLabel: input.ctaLabel,
        ctaUrl: input.ctaUrl,
        sourceEventName: 'admin.announcement_published',
        dedupeKey: `announcement:${broadcastId}:${recipient.id}`,
        metadata: { broadcastId },
        ...(input.sendEmail ? { email: { connectionId: smtpConnectionId } } : {}),
      });
    }
    await recordAuditEvent(this.db, {
      action: 'notification.announcement_published',
      resourceType: 'notification_broadcast',
      resourceId: broadcastId,
      actorId,
      metadata: { recipientCount: recipients.length, sendEmail: input.sendEmail },
    });
    return { broadcastId, recipientCount: recipients.length };
  }

  async listDeliveries(input: {
    limit: number;
    offset: number;
    status?: 'pending' | 'sending' | 'sent' | 'failed';
  }) {
    const where = input.status ? eq(notificationDeliveries.status, input.status) : undefined;
    const [items, totalResult] = await Promise.all([
      this.db
        .select({
          id: notificationDeliveries.id,
          channel: notificationDeliveries.channel,
          destination: notificationDeliveries.destination,
          status: notificationDeliveries.status,
          attempts: notificationDeliveries.attempts,
          lastError: notificationDeliveries.lastError,
          sentAt: notificationDeliveries.sentAt,
          createdAt: notificationDeliveries.createdAt,
          notificationId: notifications.id,
          notificationTitle: notifications.title,
          connectionId: integrationConnections.id,
          connectionName: integrationConnections.name,
          jobId: notificationDeliveries.jobId,
        })
        .from(notificationDeliveries)
        .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
        .leftJoin(
          integrationConnections,
          eq(integrationConnections.id, notificationDeliveries.integrationConnectionId),
        )
        .where(where)
        .orderBy(desc(notificationDeliveries.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ count: count() }).from(notificationDeliveries).where(where),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }
}
