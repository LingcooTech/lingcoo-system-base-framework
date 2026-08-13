import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type { IdentityPorts } from '@lingcootech/frame-identity';
import { NotificationService } from '@lingcootech/frame-notifications';
import { PostgresPresentationProfileReader } from '@lingcootech/frame-presentation/postgres';
import { createLegacyAuditPort, createLegacyAuditQueryPort } from '../audit/ports.js';
import { encryptSetting } from '../../core/security/settings-crypto.js';
import { httpError } from '../../host/http-error.js';
import { createLegacyNotificationsPorts } from '../notifications/ports.js';
import { createLegacyAssetsPorts } from '../assets/ports.js';
import { createLegacyJobsPortsForDatabase } from '../jobs/ports.js';
import { createLegacyIntegrationsPorts } from '../integrations/ports.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createLegacyIdentityPorts(app: FastifyInstance): IdentityPorts {
  const database = app.db;
  const notifications = new NotificationService(
    database,
    createLegacyNotificationsPorts(database, app.appEnv),
  );
  const jobs = createLegacyJobsPortsForDatabase(database).commands;
  const integrations = createLegacyIntegrationsPorts(database);
  const assets = createLegacyAssetsPorts(database, app.appEnv).references;
  const presentation = new PostgresPresentationProfileReader(database);
  const audit = createLegacyAuditPort(database);
  const auditQueries = createLegacyAuditQueryPort(database);

  async function deliveryContext(required: boolean) {
    const encryptionKey = app.appEnv.SETTINGS_ENCRYPTION_KEY;
    if (!encryptionKey) {
      if (required) throw httpError(503, '安全邮件加密密钥尚未配置', 'ConfigurationError');
      return null;
    }
    const [connection, profile] = await Promise.all([
      integrations.connections.resolveEnabled('smtp'),
      presentation.get(),
    ]);
    if (!connection) {
      if (required) throw httpError(503, '没有可用的 SMTP 邮件连接', 'ConfigurationError');
      return null;
    }
    const publicUrl =
      profile.publicUrl ?? (app.appEnv.NODE_ENV === 'production' ? null : 'http://localhost:5174');
    if (!publicUrl) {
      if (required) throw httpError(503, '品牌设置中尚未配置站点公共地址', 'ConfigurationError');
      return null;
    }
    return {
      connectionId: connection.id,
      publicUrl,
      displayName: profile.displayName,
      encryptionKey,
    };
  }

  return {
    audit: {
      record: audit.record.bind(audit),
      async listSecurityEvents(accountId, limit) {
        const page = await auditQueries.list({
          page: 1,
          pageSize: limit,
          actorId: accountId,
          actionPrefix: 'auth.',
        });
        return page.items.map(({ id, action, metadata, createdAt }) => ({
          id,
          action,
          metadata,
          createdAt,
        }));
      },
    },
    avatars: {
      async resolvePublicImage(assetId) {
        return assets.resolvePublicImage(assetId);
      },
      async replaceAccountAvatar(accountId, assetId) {
        await database.transaction((transaction) =>
          assets.replaceReferences(transaction, {
            ownerType: 'account',
            ownerId: accountId,
            fields: { avatarAssetId: assetId },
            actorId: accountId,
          }),
        );
      },
    },
    challengeDelivery: {
      async assertReady() {
        await deliveryContext(true);
      },
      async deliver(challenge) {
        const context = await deliveryContext(challenge.required);
        if (!context) return false;
        const link = new URL(challenge.path, context.publicUrl);
        link.searchParams.set('token', challenge.token);
        const text = `${challenge.body}\n\n${link.toString()}\n\n如果这不是你本人的操作，请忽略本邮件。`;
        const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#17211c"><h2>${escapeHtml(challenge.subject)}</h2><p>${escapeHtml(challenge.body)}</p><p><a href="${escapeHtml(link.toString())}" style="display:inline-block;padding:11px 18px;color:#fff;background:#315f47;border-radius:8px;text-decoration:none">继续安全操作</a></p><p style="color:#6b756f;font-size:12px">如果按钮无法打开，请复制以下地址：<br>${escapeHtml(link.toString())}</p></div>`;
        await notifications.create({
          recipientAccountId: challenge.accountId,
          category: 'account',
          level: challenge.purpose === 'password_reset' ? 'warning' : 'info',
          title: challenge.title,
          body: challenge.body,
          dedupeKey: `auth-challenge:${randomUUID()}`,
          metadata: { purpose: challenge.purpose },
          email: {
            transportId: context.connectionId,
            content: encryptSetting(
              { subject: `${context.displayName} · ${challenge.subject}`, text, html },
              context.encryptionKey,
            ),
          },
        });
        return true;
      },
    },
    events: {
      async publish(event) {
        await jobs.publish({
          ...event,
          dedupeKey: `${event.topic}:${randomUUID()}`,
        });
      },
    },
  };
}
