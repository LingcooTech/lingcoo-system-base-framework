import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  accountRoles,
  accounts,
  authSessions,
  outboxEvents,
  passwordCredentials,
  permissions,
  rolePermissions,
  roles,
} from '../../db/schema.js';

export class AuthRepository {
  constructor(private readonly db: Database) {}

  async countAccounts(): Promise<number> {
    const [result] = await this.db.select({ count: sql<number>`count(*)::int` }).from(accounts);
    return result?.count ?? 0;
  }

  async findAccountByEmail(email: string) {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    return account ?? null;
  }

  async findAccountById(accountId: string) {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return account ?? null;
  }

  async findPasswordCredential(accountId: string) {
    const [credential] = await this.db
      .select()
      .from(passwordCredentials)
      .where(eq(passwordCredentials.accountId, accountId))
      .limit(1);
    return credential ?? null;
  }

  async getAccess(accountId: string) {
    const roleRows = await this.db
      .select({ id: roles.id, code: roles.code, name: roles.name })
      .from(accountRoles)
      .innerJoin(roles, eq(accountRoles.roleId, roles.id))
      .where(eq(accountRoles.accountId, accountId))
      .orderBy(asc(roles.code));
    const roleIds = roleRows.map((role) => role.id);
    const permissionRows =
      roleIds.length === 0
        ? []
        : await this.db
            .select({ code: rolePermissions.permissionCode })
            .from(rolePermissions)
            .where(inArray(rolePermissions.roleId, roleIds))
            .orderBy(asc(rolePermissions.permissionCode));

    const permissionCodes = [...new Set(permissionRows.map((permission) => permission.code))];
    if (roleRows.some((role) => role.code === 'owner')) {
      const allPermissions = await this.db
        .select({ code: permissions.code })
        .from(permissions)
        .orderBy(asc(permissions.code));
      return { roles: roleRows, permissions: allPermissions.map((permission) => permission.code) };
    }
    return { roles: roleRows, permissions: permissionCodes };
  }

  async createSession(input: {
    accountId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const [session] = await this.db
      .insert(authSessions)
      .values({
        accountId: input.accountId,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })
      .returning();
    return session;
  }

  async resolveSession(sessionId: string, accountId: string) {
    const [result] = await this.db
      .select({ session: authSessions, account: accounts })
      .from(authSessions)
      .innerJoin(accounts, eq(authSessions.accountId, accounts.id))
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.accountId, accountId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
          eq(accounts.status, 'active'),
        ),
      )
      .limit(1);
    return result ?? null;
  }

  async touchSession(sessionId: string, previousSeenAt: Date): Promise<void> {
    if (Date.now() - previousSeenAt.getTime() < 5 * 60_000) return;
    await this.db
      .update(authSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(authSessions.id, sessionId));
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
  }

  async revokeOtherSessions(accountId: string, currentSessionId: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authSessions.accountId, accountId),
          ne(authSessions.id, currentSessionId),
          isNull(authSessions.revokedAt),
        ),
      );
  }

  async markLogin(accountId: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, accountId));
  }

  async updatePassword(
    accountId: string,
    passwordHash: string,
    currentSessionId: string,
  ): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction
        .update(passwordCredentials)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(passwordCredentials.accountId, accountId));
      await transaction
        .update(accounts)
        .set({ mustChangePassword: false, updatedAt: new Date() })
        .where(eq(accounts.id, accountId));
      await transaction
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(authSessions.accountId, accountId),
            ne(authSessions.id, currentSessionId),
            isNull(authSessions.revokedAt),
          ),
        );
      await transaction.insert(outboxEvents).values({
        topic: 'auth.password_changed',
        aggregateType: 'account',
        aggregateId: accountId,
        payload: { accountId },
        dedupeKey: `auth.password_changed:${randomUUID()}`,
      });
    });
  }

  async listAccounts() {
    return this.db.select().from(accounts).orderBy(desc(accounts.createdAt));
  }

  async listRoles() {
    const roleRows = await this.db.select().from(roles).orderBy(asc(roles.code));
    const permissionRows = await this.db
      .select({
        roleId: rolePermissions.roleId,
        code: rolePermissions.permissionCode,
      })
      .from(rolePermissions)
      .orderBy(asc(rolePermissions.permissionCode));
    return roleRows.map((role) => ({
      ...role,
      permissions: permissionRows
        .filter((permission) => permission.roleId === role.id)
        .map((permission) => permission.code),
    }));
  }

  async listPermissions() {
    return this.db.select().from(permissions).orderBy(asc(permissions.code));
  }

  async findRolesByCodes(roleCodes: string[]) {
    if (roleCodes.length === 0) return [];
    return this.db.select().from(roles).where(inArray(roles.code, roleCodes));
  }

  async countOtherActiveOwners(accountId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(distinct ${accounts.id})::int` })
      .from(accounts)
      .innerJoin(accountRoles, eq(accountRoles.accountId, accounts.id))
      .innerJoin(roles, eq(accountRoles.roleId, roles.id))
      .where(
        and(eq(accounts.status, 'active'), eq(roles.code, 'owner'), ne(accounts.id, accountId)),
      );
    return result?.count ?? 0;
  }
}
