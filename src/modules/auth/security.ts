import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { and, desc, eq, gt, ilike, isNull, ne } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  accounts,
  auditLogs,
  authSecurityChallenges,
  authSessions,
  integrationConnections,
  outboxEvents,
  passwordCredentials,
  storageAssetReferences,
  storageAssets,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { encryptSetting } from '../../lib/settings-crypto.js';
import { NotificationService } from '../notifications/service.js';
import { PresentationService } from '../presentation/service.js';

export type SecurityChallengePurpose =
  'password_reset' | 'email_verification' | 'account_invitation';

const purposeConfig = {
  password_reset: {
    expiresMs: 30 * 60_000,
    path: '/auth/reset-password',
    subject: '重置你的账号密码',
    title: '密码重置请求',
    body: '系统收到了账号密码重置请求。链接将在 30 分钟后失效；如果不是你本人操作，可以忽略。',
  },
  email_verification: {
    expiresMs: 24 * 60 * 60_000,
    path: '/auth/verify-email',
    subject: '验证你的账号邮箱',
    title: '验证账号邮箱',
    body: '请通过邮件中的安全链接完成邮箱验证。链接将在 24 小时后失效。',
  },
  account_invitation: {
    expiresMs: 72 * 60 * 60_000,
    path: '/auth/accept-invitation',
    subject: '接受系统账号邀请',
    title: '你已被邀请加入系统',
    body: '管理员已为你创建账号。请通过邮件中的安全链接设置密码，邀请将在 72 小时后失效。',
  },
} as const;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class AccountSecurityService {
  private readonly notifications: NotificationService;
  private readonly presentation: PresentationService;

  constructor(
    private readonly db: Database,
    private readonly encryptionKey: string | undefined,
    private readonly nodeEnv: 'development' | 'test' | 'production',
  ) {
    this.notifications = new NotificationService(db);
    this.presentation = new PresentationService(db);
  }

  private async deliveryContext(required: boolean) {
    if (!this.encryptionKey) {
      if (required) throw httpError(503, '安全邮件加密密钥尚未配置', 'ConfigurationError');
      return null;
    }
    const [connection, profile] = await Promise.all([
      this.db
        .select({ id: integrationConnections.id })
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.providerCode, 'smtp'),
            eq(integrationConnections.enabled, true),
          ),
        )
        .orderBy(desc(integrationConnections.updatedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.presentation.get(),
    ]);
    if (!connection) {
      if (required) throw httpError(503, '没有可用的 SMTP 邮件连接', 'ConfigurationError');
      return null;
    }
    const publicUrl =
      profile.publicUrl ?? (this.nodeEnv === 'production' ? null : 'http://localhost:5174');
    if (!publicUrl) {
      if (required) throw httpError(503, '品牌设置中尚未配置站点公共地址', 'ConfigurationError');
      return null;
    }
    return { connectionId: connection.id, publicUrl, displayName: profile.displayName };
  }

  private async issueChallenge(
    accountId: string,
    purpose: SecurityChallengePurpose,
    input: { requestedIp?: string; createdBy?: string; requireDelivery: boolean },
  ) {
    const delivery = await this.deliveryContext(input.requireDelivery);
    if (!delivery) return false;
    const config = purposeConfig[purpose];
    const token = randomBytes(32).toString('base64url');
    const [challenge] = await this.db.transaction(async (transaction) => {
      await transaction
        .update(authSecurityChallenges)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(authSecurityChallenges.accountId, accountId),
            eq(authSecurityChallenges.purpose, purpose),
            isNull(authSecurityChallenges.consumedAt),
          ),
        );
      return transaction
        .insert(authSecurityChallenges)
        .values({
          accountId,
          purpose,
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + config.expiresMs),
          requestedIp: input.requestedIp,
          createdBy: input.createdBy,
        })
        .returning();
    });
    const link = new URL(config.path, delivery.publicUrl);
    link.searchParams.set('token', token);
    const text = `${config.body}\n\n${link.toString()}\n\n如果这不是你本人的操作，请忽略本邮件。`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#17211c"><h2>${escapeHtml(config.subject)}</h2><p>${escapeHtml(config.body)}</p><p><a href="${escapeHtml(link.toString())}" style="display:inline-block;padding:11px 18px;color:#fff;background:#315f47;border-radius:8px;text-decoration:none">继续安全操作</a></p><p style="color:#6b756f;font-size:12px">如果按钮无法打开，请复制以下地址：<br>${escapeHtml(link.toString())}</p></div>`;
    await this.notifications.create({
      recipientAccountId: accountId,
      category: 'account',
      level: purpose === 'password_reset' ? 'warning' : 'info',
      title: config.title,
      body: config.body,
      dedupeKey: `auth-challenge:${challenge.id}`,
      metadata: { purpose, challengeId: challenge.id },
      email: {
        connectionId: delivery.connectionId,
        encryptedContent: encryptSetting(
          { subject: `${delivery.displayName} · ${config.subject}`, text, html },
          this.encryptionKey!,
        ),
      },
    });
    await recordAuditEvent(this.db, {
      action: `auth.${purpose}_requested`,
      resourceType: 'account',
      resourceId: accountId,
      actorId: input.createdBy ?? accountId,
      metadata: { challengeId: challenge.id },
    });
    return true;
  }

  async requestPasswordReset(email: string, requestedIp?: string): Promise<void> {
    const [account] = await this.db
      .select({ id: accounts.id, status: accounts.status })
      .from(accounts)
      .where(eq(accounts.email, email.trim().toLowerCase()))
      .limit(1);
    if (!account || account.status !== 'active') return;
    await this.issueChallenge(account.id, 'password_reset', {
      requestedIp,
      requireDelivery: false,
    });
  }

  async requestEmailVerification(accountId: string, requestedIp?: string): Promise<boolean> {
    const [account] = await this.db
      .select({ emailVerifiedAt: accounts.emailVerifiedAt })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    if (!account) throw httpError(404, '账号不存在', 'NotFoundError');
    if (account.emailVerifiedAt) return false;
    return this.issueChallenge(accountId, 'email_verification', {
      requestedIp,
      createdBy: accountId,
      requireDelivery: true,
    });
  }

  async invite(accountId: string, actorId: string): Promise<void> {
    await this.issueChallenge(accountId, 'account_invitation', {
      createdBy: actorId,
      requireDelivery: true,
    });
  }

  async assertInvitationReady(): Promise<void> {
    await this.deliveryContext(true);
  }

  private async consumeChallenge(token: string, purpose: SecurityChallengePurpose) {
    const [challenge] = await this.db
      .select()
      .from(authSecurityChallenges)
      .where(
        and(
          eq(authSecurityChallenges.tokenHash, tokenHash(token)),
          eq(authSecurityChallenges.purpose, purpose),
          isNull(authSecurityChallenges.consumedAt),
          gt(authSecurityChallenges.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!challenge) throw httpError(422, '安全链接无效或已过期', 'ValidationError');
    return challenge;
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const challenge = await this.consumeChallenge(token, 'password_reset');
    const credential = await this.db
      .select({ passwordHash: passwordCredentials.passwordHash })
      .from(passwordCredentials)
      .where(eq(passwordCredentials.accountId, challenge.accountId))
      .then((rows) => rows[0]);
    if (credential && (await verifyPassword(password, credential.passwordHash))) {
      throw httpError(422, '新密码不能与当前密码相同', 'ValidationError');
    }
    await this.finishPasswordChallenge(challenge.id, challenge.accountId, password, false);
    await recordAuditEvent(this.db, {
      action: 'auth.password_reset_completed',
      resourceType: 'account',
      resourceId: challenge.accountId,
      actorId: challenge.accountId,
    });
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    const challenge = await this.consumeChallenge(token, 'account_invitation');
    await this.finishPasswordChallenge(challenge.id, challenge.accountId, password, true);
    await recordAuditEvent(this.db, {
      action: 'auth.invitation_accepted',
      resourceType: 'account',
      resourceId: challenge.accountId,
      actorId: challenge.accountId,
    });
  }

  private async finishPasswordChallenge(
    challengeId: string,
    accountId: string,
    password: string,
    verifyEmail: boolean,
  ) {
    const passwordHash = await hashPassword(password);
    await this.db.transaction(async (transaction) => {
      const [locked] = await transaction
        .select({ consumedAt: authSecurityChallenges.consumedAt })
        .from(authSecurityChallenges)
        .where(eq(authSecurityChallenges.id, challengeId))
        .for('update');
      if (!locked || locked.consumedAt) throw httpError(422, '安全链接已经使用', 'ValidationError');
      await transaction
        .update(passwordCredentials)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(passwordCredentials.accountId, accountId));
      await transaction
        .update(accounts)
        .set({
          mustChangePassword: false,
          ...(verifyEmail ? { emailVerifiedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId));
      await transaction
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.accountId, accountId), isNull(authSessions.revokedAt)));
      await transaction
        .update(authSecurityChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(authSecurityChallenges.id, challengeId));
      await transaction.insert(outboxEvents).values({
        topic: 'auth.password_changed',
        aggregateType: 'account',
        aggregateId: accountId,
        payload: { accountId },
        dedupeKey: `auth.password_changed:${randomUUID()}`,
      });
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const challenge = await this.consumeChallenge(token, 'email_verification');
    await this.db.transaction(async (transaction) => {
      const updated = await transaction
        .update(authSecurityChallenges)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(authSecurityChallenges.id, challenge.id),
            isNull(authSecurityChallenges.consumedAt),
          ),
        )
        .returning({ id: authSecurityChallenges.id });
      if (!updated.length) throw httpError(422, '安全链接已经使用', 'ValidationError');
      await transaction
        .update(accounts)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(accounts.id, challenge.accountId));
    });
    await recordAuditEvent(this.db, {
      action: 'auth.email_verified',
      resourceType: 'account',
      resourceId: challenge.accountId,
      actorId: challenge.accountId,
    });
  }

  async getProfile(accountId: string) {
    const [row] = await this.db
      .select({
        id: accounts.id,
        email: accounts.email,
        displayName: accounts.displayName,
        avatarAssetId: accounts.avatarAssetId,
        emailVerifiedAt: accounts.emailVerifiedAt,
        createdAt: accounts.createdAt,
        avatarUrl: storageAssets.publicUrl,
      })
      .from(accounts)
      .leftJoin(storageAssets, eq(accounts.avatarAssetId, storageAssets.id))
      .where(eq(accounts.id, accountId));
    if (!row) throw httpError(404, '账号不存在', 'NotFoundError');
    return row;
  }

  async updateProfile(
    accountId: string,
    input: { displayName: string; avatarAssetId: string | null },
  ) {
    if (input.avatarAssetId) {
      const [asset] = await this.db
        .select({ id: storageAssets.id })
        .from(storageAssets)
        .where(
          and(
            eq(storageAssets.id, input.avatarAssetId),
            eq(storageAssets.status, 'active'),
            eq(storageAssets.visibility, 'public'),
            eq(storageAssets.mediaKind, 'image'),
          ),
        );
      if (!asset) throw httpError(422, '头像必须是已启用的公开图片资产', 'ValidationError');
    }
    await this.db.transaction(async (transaction) => {
      await transaction
        .update(accounts)
        .set({
          displayName: input.displayName,
          avatarAssetId: input.avatarAssetId,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, accountId));
      await transaction
        .delete(storageAssetReferences)
        .where(
          and(
            eq(storageAssetReferences.ownerType, 'account'),
            eq(storageAssetReferences.ownerId, accountId),
            eq(storageAssetReferences.field, 'avatarAssetId'),
          ),
        );
      if (input.avatarAssetId)
        await transaction.insert(storageAssetReferences).values({
          assetId: input.avatarAssetId,
          ownerType: 'account',
          ownerId: accountId,
          field: 'avatarAssetId',
          createdBy: accountId,
        });
    });
    await recordAuditEvent(this.db, {
      action: 'auth.profile_updated',
      resourceType: 'account',
      resourceId: accountId,
      actorId: accountId,
      metadata: { avatarChanged: true },
    });
    return this.getProfile(accountId);
  }

  async listSessions(accountId: string, currentSessionId: string) {
    const rows = await this.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.accountId, accountId))
      .orderBy(desc(authSessions.lastSeenAt))
      .limit(30);
    return rows.map((row) => ({ ...row, current: row.id === currentSessionId }));
  }

  async revokeSession(accountId: string, currentSessionId: string, sessionId: string) {
    if (sessionId === currentSessionId)
      throw httpError(409, '不能在这里撤销当前会话，请使用退出登录', 'ConflictError');
    const [updated] = await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.accountId, accountId),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning({ id: authSessions.id });
    if (!updated) throw httpError(404, '会话不存在或已撤销', 'NotFoundError');
    await recordAuditEvent(this.db, {
      action: 'auth.session_revoked',
      resourceType: 'session',
      resourceId: sessionId,
      actorId: accountId,
    });
  }

  async revokeOtherSessions(accountId: string, currentSessionId: string) {
    const rows = await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authSessions.accountId, accountId),
          ne(authSessions.id, currentSessionId),
          isNull(authSessions.revokedAt),
        ),
      )
      .returning({ id: authSessions.id });
    await recordAuditEvent(this.db, {
      action: 'auth.other_sessions_revoked',
      resourceType: 'account',
      resourceId: accountId,
      actorId: accountId,
      metadata: { count: rows.length },
    });
    return rows.length;
  }

  async securityEvents(accountId: string) {
    return this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.actorId, accountId), ilike(auditLogs.action, 'auth.%')))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30);
  }
}
