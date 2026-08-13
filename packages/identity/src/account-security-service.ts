import { createHash, randomBytes } from 'node:crypto';

import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';

import type { Database } from '@lingcootech/frame-database';
import {
  accounts,
  authSecurityChallenges,
  authSessions,
  passwordCredentials,
} from '@lingcootech/frame-database/schema';
import { identityError } from './errors.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  createNoopIdentityPorts,
  type IdentityChallengePurpose,
  type IdentityPorts,
} from './ports.js';

export type SecurityChallengePurpose = IdentityChallengePurpose;

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

export class AccountSecurityService {
  constructor(
    private readonly db: Database,
    private readonly ports: IdentityPorts = createNoopIdentityPorts(),
  ) {}

  private async issueChallenge(
    accountId: string,
    purpose: SecurityChallengePurpose,
    input: { requestedIp?: string; createdBy?: string; requireDelivery: boolean },
  ) {
    if (input.requireDelivery) await this.ports.challengeDelivery.assertReady();
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
    const delivered = await this.ports.challengeDelivery.deliver({
      accountId,
      purpose,
      token,
      path: config.path,
      subject: config.subject,
      title: config.title,
      body: config.body,
      required: input.requireDelivery,
    });
    if (!delivered) {
      await this.db
        .update(authSecurityChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(authSecurityChallenges.id, challenge.id));
      return false;
    }
    await this.ports.audit.record({
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
    if (!account) throw identityError(404, '账号不存在', 'NotFoundError');
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
    await this.ports.challengeDelivery.assertReady();
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
    if (!challenge) throw identityError(422, '安全链接无效或已过期', 'ValidationError');
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
      throw identityError(422, '新密码不能与当前密码相同', 'ValidationError');
    }
    await this.finishPasswordChallenge(challenge.id, challenge.accountId, password, false);
    await this.ports.audit.record({
      action: 'auth.password_reset_completed',
      resourceType: 'account',
      resourceId: challenge.accountId,
      actorId: challenge.accountId,
    });
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    const challenge = await this.consumeChallenge(token, 'account_invitation');
    await this.finishPasswordChallenge(challenge.id, challenge.accountId, password, true);
    await this.ports.audit.record({
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
      if (!locked || locked.consumedAt)
        throw identityError(422, '安全链接已经使用', 'ValidationError');
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
    });
    await this.ports.events.publish({
      topic: 'auth.password_changed',
      aggregateType: 'account',
      aggregateId: accountId,
      payload: { accountId },
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
      if (!updated.length) throw identityError(422, '安全链接已经使用', 'ValidationError');
      await transaction
        .update(accounts)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(accounts.id, challenge.accountId));
    });
    await this.ports.audit.record({
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
      })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    if (!row) throw identityError(404, '账号不存在', 'NotFoundError');
    const avatarUrl = row.avatarAssetId
      ? ((await this.ports.avatars.resolvePublicImage(row.avatarAssetId))?.publicUrl ?? null)
      : null;
    return { ...row, avatarUrl };
  }

  async updateProfile(
    accountId: string,
    input: { displayName: string; avatarAssetId: string | null },
  ) {
    if (input.avatarAssetId) {
      const asset = await this.ports.avatars.resolvePublicImage(input.avatarAssetId);
      if (!asset) throw identityError(422, '头像必须是已启用的公开图片资产', 'ValidationError');
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
    });
    await this.ports.avatars.replaceAccountAvatar(accountId, input.avatarAssetId);
    await this.ports.audit.record({
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
      throw identityError(409, '不能在这里撤销当前会话，请使用退出登录', 'ConflictError');
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
    if (!updated) throw identityError(404, '会话不存在或已撤销', 'NotFoundError');
    await this.ports.audit.record({
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
    await this.ports.audit.record({
      action: 'auth.other_sessions_revoked',
      resourceType: 'account',
      resourceId: accountId,
      actorId: accountId,
      metadata: { count: rows.length },
    });
    return rows.length;
  }

  async securityEvents(accountId: string) {
    return this.ports.audit.listSecurityEvents(accountId, 30);
  }
}
