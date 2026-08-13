import { randomUUID } from 'node:crypto';

import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';

import type { Database } from '@lingcootech/frame-database';
import { notificationDeliveries, notifications } from '@lingcootech/frame-database/schema';
import { notificationsError } from './errors.js';
import { createNoopNotificationsPorts, type NotificationsPorts } from './ports.js';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

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
  email?: { transportId?: string; content?: unknown };
}

export class NotificationService {
  constructor(
    private readonly db: Database,
    private readonly ports: NotificationsPorts = createNoopNotificationsPorts(),
  ) {}

  async create(input: CreateNotificationInput) {
    const [transport, destination] = input.email
      ? await Promise.all([
          this.ports.mail.resolveTransport(input.email.transportId),
          this.ports.accounts
            .findById(input.recipientAccountId)
            .then((account) => account?.email ?? null),
        ])
      : [null, null];

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

      if (transport && destination) {
        const [delivery] = await transaction
          .insert(notificationDeliveries)
          .values({
            notificationId: created.id,
            channel: 'email',
            destination,
            transportId: transport.id,
            transportLabel: transport.label,
            content: input.email?.content,
          })
          .returning({ id: notificationDeliveries.id });
        const job = await this.ports.jobs.enqueue(
          {
            queue: 'notifications',
            kind: 'notification.email.deliver',
            payload: { deliveryId: delivery.id },
            dedupeKey: `notification-email:${created.id}`,
            relatedEntityType: 'notification',
            relatedEntityId: created.id,
            maxAttempts: 5,
          },
          transaction,
        );
        await transaction
          .update(notificationDeliveries)
          .set({ jobId: job.id, updatedAt: new Date() })
          .where(eq(notificationDeliveries.id, delivery.id));
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
    if (!this.ports.accounts.configured) {
      throw notificationsError(503, '通知账号目录尚未配置', 'ConfigurationError');
    }
    const filters = [];
    if (input.status) filters.push(eq(notifications.status, input.status));
    if (input.category) filters.push(eq(notifications.category, input.category));
    if (input.search) {
      const pattern = `%${input.search}%`;
      const matchingAccountIds = await this.ports.accounts.findMatchingIds(input.search);
      filters.push(
        or(
          ilike(notifications.title, pattern),
          ilike(notifications.body, pattern),
          ...(matchingAccountIds.length
            ? [inArray(notifications.recipientAccountId, [...matchingAccountIds])]
            : []),
        )!,
      );
    }
    const where = filters.length ? and(...filters) : undefined;
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
    const accountRows = await this.ports.accounts.findByIds(
      items.map((item) => item.recipientAccountId),
    );
    const accountsById = new Map(accountRows.map((account) => [account.id, account]));
    return {
      items: items.map((item) => ({
        ...item,
        recipient: accountsById.get(item.recipientAccountId) ?? null,
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
    if (!updated) throw notificationsError(404, '通知不存在', 'NotFoundError');
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
    if (!updated) throw notificationsError(404, '通知不存在', 'NotFoundError');
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
    },
    actorId: string,
  ) {
    if (!this.ports.accounts.configured) {
      throw notificationsError(503, '通知账号目录尚未配置', 'ConfigurationError');
    }
    const transport = input.sendEmail ? await this.ports.mail.resolveTransport() : null;
    if (input.sendEmail && !transport) {
      throw notificationsError(422, '没有可用的邮件投递通道', 'ValidationError');
    }
    const recipients = await this.ports.accounts.listActive();
    const broadcastId = randomUUID();
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
        ...(transport ? { email: { transportId: transport.id } } : {}),
      });
    }
    await this.ports.audit.record({
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
          transportId: notificationDeliveries.transportId,
          transportLabel: notificationDeliveries.transportLabel,
          jobId: notificationDeliveries.jobId,
        })
        .from(notificationDeliveries)
        .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
        .where(where)
        .orderBy(desc(notificationDeliveries.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ count: count() }).from(notificationDeliveries).where(where),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }
}
