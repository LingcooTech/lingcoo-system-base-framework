export const basePermissions = [
  'admin.access',
  'system.runtime.read',
  'system.settings.read',
  'system.settings.write',
  'iam.accounts.read',
  'iam.accounts.write',
  'iam.roles.read',
  'iam.roles.write',
  'audit.read',
  'integrations.read',
  'integrations.write',
  'jobs.read',
  'jobs.write',
  'notifications.read',
  'notifications.manage',
] as const;

export type BasePermission = (typeof basePermissions)[number];
export type PermissionCode = BasePermission | (string & {});

export const systemRoleCodes = ['owner', 'administrator', 'operator', 'viewer'] as const;
export type SystemRoleCode = (typeof systemRoleCodes)[number];

export function hasPermission(
  roleCodes: readonly string[],
  permissions: readonly string[],
  required: PermissionCode,
): boolean {
  return roleCodes.includes('owner') || permissions.includes(required);
}

export function hasAnyPermission(
  roleCodes: readonly string[],
  permissions: readonly string[],
  required: readonly PermissionCode[],
): boolean {
  return required.some((permission) => hasPermission(roleCodes, permissions, permission));
}

export function normalizeRoleCode(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidRoleCode(value: string): boolean {
  return /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value);
}
