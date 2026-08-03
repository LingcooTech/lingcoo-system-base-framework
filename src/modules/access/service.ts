import { randomBytes } from 'node:crypto';

import { eq, inArray } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  accountRoles,
  accounts,
  passwordCredentials,
  permissions,
  rolePermissions,
  roles,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import { hashPassword } from '../../lib/password.js';
import { normalizeRoleCode } from '../../lib/rbac.js';
import { AuthRepository } from '../auth/repository.js';
import { AccountSecurityService } from '../auth/security.js';

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export class AccessService {
  private readonly repository: AuthRepository;
  private readonly security: AccountSecurityService;

  constructor(
    private readonly db: Database,
    encryptionKey?: string,
    nodeEnv: 'development' | 'test' | 'production' = 'development',
  ) {
    this.repository = new AuthRepository(db);
    this.security = new AccountSecurityService(db, encryptionKey, nodeEnv);
  }

  async listAccounts() {
    const accountRows = await this.repository.listAccounts();
    return Promise.all(
      accountRows.map(async (account) => {
        const access = await this.repository.getAccess(account.id);
        return {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          avatarAssetId: account.avatarAssetId,
          avatarUrl: null,
          emailVerifiedAt: account.emailVerifiedAt,
          status: account.status,
          mustChangePassword: account.mustChangePassword,
          lastLoginAt: account.lastLoginAt,
          createdAt: account.createdAt,
          roles: access.roles.map((role) => ({ code: role.code, name: role.name })),
        };
      }),
    );
  }

  async listRoles() {
    return this.repository.listRoles();
  }

  async listPermissions() {
    return this.repository.listPermissions();
  }

  async createAccount(
    input: {
      email: string;
      displayName: string;
      setupMethod: 'invitation' | 'temporary_password';
      password?: string;
      roleCodes: string[];
    },
    actorId: string,
  ) {
    const email = input.email.trim().toLowerCase();
    if (await this.repository.findAccountByEmail(email)) {
      throw httpError(409, '该邮箱已被使用', 'ConflictError');
    }
    const roleCodes = unique(input.roleCodes.map(normalizeRoleCode));
    const assignedRoles = await this.repository.findRolesByCodes(roleCodes);
    if (assignedRoles.length !== roleCodes.length) {
      throw httpError(422, '包含不存在的角色', 'ValidationError');
    }
    if (input.setupMethod === 'invitation') await this.security.assertInvitationReady();
    const passwordHash = await hashPassword(
      input.setupMethod === 'invitation' ? randomBytes(48).toString('base64url') : input.password!,
    );
    const accountId = await this.db.transaction(async (transaction) => {
      const [account] = await transaction
        .insert(accounts)
        .values({
          email,
          displayName: input.displayName.trim(),
          mustChangePassword: true,
        })
        .returning({ id: accounts.id });
      await transaction.insert(passwordCredentials).values({ accountId: account.id, passwordHash });
      await transaction
        .insert(accountRoles)
        .values(assignedRoles.map((role) => ({ accountId: account.id, roleId: role.id })));
      return account.id;
    });
    await recordAuditEvent(this.db, {
      action: 'iam.account_created',
      resourceType: 'account',
      resourceId: accountId,
      actorId,
      metadata: { roleCodes, setupMethod: input.setupMethod },
    });
    if (input.setupMethod === 'invitation') await this.security.invite(accountId, actorId);
    return this.repository.findAccountById(accountId);
  }

  async resendInvitation(accountId: string, actorId: string) {
    const account = await this.repository.findAccountById(accountId);
    if (!account) throw httpError(404, '账号不存在', 'NotFoundError');
    if (account.emailVerifiedAt)
      throw httpError(409, '该账号邮箱已经验证，无需重新邀请', 'ConflictError');
    await this.security.invite(accountId, actorId);
    await recordAuditEvent(this.db, {
      action: 'iam.account_invitation_resent',
      resourceType: 'account',
      resourceId: accountId,
      actorId,
    });
  }

  async updateAccount(
    accountId: string,
    input: {
      displayName?: string;
      status?: 'active' | 'suspended';
      roleCodes?: string[];
    },
    actorId: string,
  ) {
    const account = await this.repository.findAccountById(accountId);
    if (!account) throw httpError(404, '账号不存在', 'NotFoundError');
    if (accountId === actorId && input.status === 'suspended') {
      throw httpError(409, '不能停用当前登录账号', 'ConflictError');
    }

    const currentAccess = await this.repository.getAccess(accountId);
    const nextRoleCodes = input.roleCodes
      ? unique(input.roleCodes.map(normalizeRoleCode))
      : currentAccess.roles.map((role) => role.code);
    const removesOwner =
      currentAccess.roles.some((role) => role.code === 'owner') &&
      (input.status === 'suspended' || !nextRoleCodes.includes('owner'));
    if (removesOwner && (await this.repository.countOtherActiveOwners(accountId)) === 0) {
      throw httpError(409, '系统必须保留至少一个启用的所有者账号', 'ConflictError');
    }

    const assignedRoles = input.roleCodes
      ? await this.repository.findRolesByCodes(nextRoleCodes)
      : null;
    if (assignedRoles && assignedRoles.length !== nextRoleCodes.length) {
      throw httpError(422, '包含不存在的角色', 'ValidationError');
    }

    await this.db.transaction(async (transaction) => {
      if (input.displayName !== undefined || input.status !== undefined) {
        await transaction
          .update(accounts)
          .set({
            ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, accountId));
      }
      if (assignedRoles) {
        await transaction.delete(accountRoles).where(eq(accountRoles.accountId, accountId));
        await transaction
          .insert(accountRoles)
          .values(assignedRoles.map((role) => ({ accountId, roleId: role.id })));
      }
    });
    await recordAuditEvent(this.db, {
      action: 'iam.account_updated',
      resourceType: 'account',
      resourceId: accountId,
      actorId,
      metadata: {
        ...(input.displayName !== undefined ? { displayNameChanged: true } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.roleCodes !== undefined ? { roleCodes: nextRoleCodes } : {}),
      },
    });
    return this.repository.findAccountById(accountId);
  }

  async createRole(
    input: { code: string; name: string; description?: string; permissions: string[] },
    actorId: string,
  ) {
    const normalizedCode = normalizeRoleCode(input.code);
    const [existingRole] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, normalizedCode))
      .limit(1);
    if (existingRole) {
      throw httpError(409, '角色代码已存在', 'ConflictError');
    }
    const permissionCodes = unique(input.permissions);
    const knownPermissions =
      permissionCodes.length === 0
        ? []
        : await this.db
            .select({ code: permissions.code })
            .from(permissions)
            .where(inArray(permissions.code, permissionCodes));
    if (knownPermissions.length !== permissionCodes.length) {
      throw httpError(422, '包含不存在的权限', 'ValidationError');
    }
    const roleId = await this.db.transaction(async (transaction) => {
      const [role] = await transaction
        .insert(roles)
        .values({
          code: normalizedCode,
          name: input.name,
          description: input.description,
        })
        .returning({ id: roles.id });
      if (permissionCodes.length > 0) {
        await transaction.insert(rolePermissions).values(
          permissionCodes.map((permissionCode) => ({
            roleId: role.id,
            permissionCode,
          })),
        );
      }
      return role.id;
    });
    await recordAuditEvent(this.db, {
      action: 'iam.role_created',
      resourceType: 'role',
      resourceId: roleId,
      actorId,
      metadata: { code: normalizedCode, permissions: permissionCodes },
    });
    return roleId;
  }

  async updateRole(
    roleId: string,
    input: { name?: string; description?: string; permissions?: string[] },
    actorId: string,
  ) {
    const [role] = await this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!role) throw httpError(404, '角色不存在', 'NotFoundError');
    if (role.isSystem) {
      throw httpError(409, '系统内置角色不能修改', 'ConflictError');
    }
    const permissionCodes = input.permissions ? unique(input.permissions) : undefined;
    if (permissionCodes) {
      const known =
        permissionCodes.length === 0
          ? []
          : await this.db
              .select({ code: permissions.code })
              .from(permissions)
              .where(inArray(permissions.code, permissionCodes));
      if (known.length !== permissionCodes.length) {
        throw httpError(422, '包含不存在的权限', 'ValidationError');
      }
    }
    await this.db.transaction(async (transaction) => {
      if (input.name !== undefined || input.description !== undefined) {
        await transaction
          .update(roles)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            updatedAt: new Date(),
          })
          .where(eq(roles.id, roleId));
      }
      if (permissionCodes) {
        await transaction.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
        if (permissionCodes.length > 0) {
          await transaction
            .insert(rolePermissions)
            .values(permissionCodes.map((permissionCode) => ({ roleId, permissionCode })));
        }
      }
    });
    await recordAuditEvent(this.db, {
      action: 'iam.role_updated',
      resourceType: 'role',
      resourceId: roleId,
      actorId,
      metadata: { permissions: permissionCodes },
    });
  }
}
