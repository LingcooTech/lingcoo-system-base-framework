import { eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  accountRoles,
  accounts,
  passwordCredentials,
  roles,
  storageAssets,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { AuthRepository } from './repository.js';

const DUMMY_PASSWORD_HASH =
  'scrypt$0123456789abcdef0123456789abcdef$f45e4a5e6033ef0d469e45ad25ec85f0fbf38aef73dc49401dab4e28e8a6082e70b065dc15a73bc64a36bb68d684966de08694e30a29f8b940d17fedd2dbdf5f';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  private readonly repository: AuthRepository;

  constructor(private readonly db: Database) {
    this.repository = new AuthRepository(db);
  }

  async bootstrapOwner(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<boolean> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);
    const createdAccountId = await this.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext('frame.auth.bootstrap'))`,
      );
      const [countResult] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(accounts);
      if ((countResult?.count ?? 0) > 0) return null;

      const [ownerRole] = await transaction
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.code, 'owner'))
        .limit(1);
      if (!ownerRole) {
        throw new Error('Owner role is missing; run database migrations first');
      }

      const [account] = await transaction
        .insert(accounts)
        .values({
          email,
          displayName: input.displayName.trim(),
          mustChangePassword: true,
        })
        .returning({ id: accounts.id });
      await transaction.insert(passwordCredentials).values({
        accountId: account.id,
        passwordHash,
      });
      await transaction.insert(accountRoles).values({
        accountId: account.id,
        roleId: ownerRole.id,
      });
      return account.id;
    });

    if (!createdAccountId) return false;
    await recordAuditEvent(this.db, {
      action: 'auth.owner_bootstrapped',
      resourceType: 'account',
      resourceId: createdAccountId,
      actorId: createdAccountId,
      metadata: { source: 'environment' },
    });
    return true;
  }

  async login(
    input: { email: string; password: string },
    metadata: SessionMetadata,
    ttlHours: number,
  ) {
    const email = input.email.trim().toLowerCase();
    const account = await this.repository.findAccountByEmail(email);
    if (!account) {
      await verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      throw httpError(401, '邮箱或密码不正确', 'UnauthorizedError');
    }

    const credential = await this.repository.findPasswordCredential(account.id);
    const validPassword = credential
      ? await verifyPassword(input.password, credential.passwordHash)
      : false;
    if (!validPassword) {
      throw httpError(401, '邮箱或密码不正确', 'UnauthorizedError');
    }
    if (account.status !== 'active') {
      throw httpError(403, '账号已停用', 'ForbiddenError');
    }

    const session = await this.repository.createSession({
      accountId: account.id,
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      ...metadata,
    });
    await this.repository.markLogin(account.id);
    await recordAuditEvent(this.db, {
      action: 'auth.login',
      resourceType: 'session',
      resourceId: session.id,
      actorId: account.id,
      metadata: {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
    return {
      session,
      account: await this.getPublicAccount(account.id),
    };
  }

  async getPublicAccount(accountId: string) {
    const account = await this.repository.findAccountById(accountId);
    if (!account) throw httpError(401, '账号不存在', 'UnauthorizedError');
    const access = await this.repository.getAccess(accountId);
    const avatarUrl = account.avatarAssetId
      ? await this.db
          .select({ publicUrl: storageAssets.publicUrl })
          .from(storageAssets)
          .where(eq(storageAssets.id, account.avatarAssetId))
          .then((rows) => rows[0]?.publicUrl ?? null)
      : null;
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      avatarAssetId: account.avatarAssetId,
      avatarUrl,
      emailVerifiedAt: account.emailVerifiedAt,
      status: account.status,
      mustChangePassword: account.mustChangePassword,
      lastLoginAt: account.lastLoginAt,
      roles: access.roles.map((role) => ({ code: role.code, name: role.name })),
      permissions: access.permissions,
    };
  }

  async logout(accountId: string, sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId);
    await recordAuditEvent(this.db, {
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: sessionId,
      actorId: accountId,
    });
  }

  async changePassword(
    accountId: string,
    sessionId: string,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const credential = await this.repository.findPasswordCredential(accountId);
    if (!credential || !(await verifyPassword(input.currentPassword, credential.passwordHash))) {
      throw httpError(422, '当前密码不正确', 'ValidationError');
    }

    await this.repository.updatePassword(
      accountId,
      await hashPassword(input.newPassword),
      sessionId,
    );
    await recordAuditEvent(this.db, {
      action: 'auth.password_changed',
      resourceType: 'account',
      resourceId: accountId,
      actorId: accountId,
    });
  }
}
