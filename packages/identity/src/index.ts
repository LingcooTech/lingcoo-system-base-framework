export {
  createIdentityExtension,
  frameIdentityExtension,
  type CreateIdentityExtensionOptions,
} from './extension.js';
export { identityError } from './errors.js';
export {
  createNoopIdentityAccountDirectory,
  type IdentityAccountDirectoryPort,
  type IdentityAccountSummary,
} from './account-directory.js';
export * from './ports.js';
export * from './access-schemas.js';
export {
  DEFAULT_IDENTITY_ENVIRONMENT_ID,
  defaultIdentityEnvironment,
  defaultIdentityEnvironmentVariables,
  LEGACY_IDENTITY_ENVIRONMENT_ID,
  type DefaultIdentityEnvironment,
} from './environment.js';
export { frameIdentityManifest, identityServerRoutes } from './manifest.js';
export {
  identityMigrationExtension,
  identityMigrationSource,
  identityMigrationsDirectory,
} from './migrations.js';
export { hashPassword, verifyPassword } from './password.js';
export { createCookieSessionSecurityProvider } from './provider.js';
export {
  createIdentityServerExtension,
  type CreateIdentityServerOptions,
  type IdentityPortsFactory,
} from './server.js';
export { AuthRepository } from './repository.js';
export * from './schemas.js';
export {
  basePermissions,
  hasAnyPermission,
  hasPermission,
  identityPermissions,
  isValidRoleCode,
  kernelPermissions,
  normalizeRoleCode,
  systemRoleCodes,
  type BasePermission,
  type PermissionCode,
  type SystemRoleCode,
} from './rbac.js';
