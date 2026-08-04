import semver from 'semver';

export const FRAME_VERSION = '0.3.0';
export const EXTENSION_API_VERSION = '1';

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const contributionPattern = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
const migrationIdPattern = /^[a-z0-9][a-z0-9._-]*\.sql$/;
const secretSettingPattern = /(?:secret|password|token|credential|api[._-]?key|private[._-]?key)/i;
const routeMethods = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']);

export type ExtensionRouteMethod = 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';

export interface ExtensionDependency {
  id: string;
  version: string;
}

export interface ExtensionRouteDeclaration {
  method: ExtensionRouteMethod;
  path: string;
}

export interface ExtensionMigrationDeclaration {
  id: string;
  legacyAliases?: readonly string[];
}

export interface ExtensionMigrationSourceDeclaration {
  sourceId: string;
  migrations: readonly ExtensionMigrationDeclaration[];
}

export interface ExtensionManifest {
  id: string;
  version: string;
  apiVersion: string;
  frame: string;
  dependencies?: readonly ExtensionDependency[];
  optionalDependencies?: readonly ExtensionDependency[];
  permissions?: readonly string[];
  settings?: readonly string[];
  server?: {
    routes?: readonly ExtensionRouteDeclaration[];
  };
  worker?: {
    jobs?: readonly string[];
    subscriptions?: readonly string[];
  };
  migrations?: ExtensionMigrationSourceDeclaration;
}

export interface ExtensionDefinition {
  manifest: ExtensionManifest;
  server?: unknown;
  worker?: unknown;
  migrations?: unknown;
}

export interface DefineSystemOptions {
  id: string;
  version: string;
  extensions: readonly ExtensionDefinition[];
  frameVersion?: string;
  extensionApiVersion?: string;
}

export interface DefinedSystem {
  readonly id: string;
  readonly version: string;
  readonly frameVersion: string;
  readonly extensionApiVersion: string;
  readonly extensions: readonly ExtensionDefinition[];
}

export class ExtensionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtensionValidationError';
  }
}

function fail(message: string): never {
  throw new ExtensionValidationError(message);
}

function validateIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) fail(`Invalid ${label}: ${value}`);
}

function validateContribution(value: string, label: string): void {
  if (!contributionPattern.test(value)) fail(`Invalid ${label}: ${value}`);
}

function validateVersion(value: string, label: string): void {
  if (!semver.valid(value)) fail(`Invalid ${label}: ${value}`);
}

function validateRange(value: string, label: string): void {
  if (!semver.validRange(value)) fail(`Invalid ${label}: ${value}`);
}

function claim(
  claims: Map<string, string>,
  value: string,
  owner: string,
  contribution: string,
): void {
  const existing = claims.get(value);
  if (existing) {
    fail(`Duplicate ${contribution} ${value} declared by ${existing} and ${owner}`);
  }
  claims.set(value, owner);
}

function validateManifest(
  manifest: ExtensionManifest,
  frameVersion: string,
  apiVersion: string,
): void {
  validateIdentifier(manifest.id, 'extension id');
  validateVersion(manifest.version, `version for extension ${manifest.id}`);
  validateRange(manifest.frame, `Frame range for extension ${manifest.id}`);
  if (!semver.satisfies(frameVersion, manifest.frame)) {
    fail(
      `Extension ${manifest.id}@${manifest.version} requires Frame ${manifest.frame}, current version is ${frameVersion}`,
    );
  }
  if (manifest.apiVersion !== apiVersion) {
    fail(
      `Extension ${manifest.id}@${manifest.version} uses API ${manifest.apiVersion}, expected ${apiVersion}`,
    );
  }

  const dependencies = new Set<string>();
  for (const dependency of [
    ...(manifest.dependencies ?? []),
    ...(manifest.optionalDependencies ?? []),
  ]) {
    validateIdentifier(dependency.id, `dependency id in ${manifest.id}`);
    validateRange(dependency.version, `dependency range for ${manifest.id} -> ${dependency.id}`);
    if (dependencies.has(dependency.id)) {
      fail(`Duplicate dependency ${dependency.id} in extension ${manifest.id}`);
    }
    if (dependency.id === manifest.id) fail(`Extension ${manifest.id} cannot depend on itself`);
    dependencies.add(dependency.id);
  }

  for (const permission of manifest.permissions ?? []) {
    validateContribution(permission, `permission in ${manifest.id}`);
  }
  for (const setting of manifest.settings ?? []) {
    validateContribution(setting, `setting key in ${manifest.id}`);
    if (secretSettingPattern.test(setting)) {
      fail(`Extension setting ${setting} appears to contain secret material`);
    }
  }
  for (const route of manifest.server?.routes ?? []) {
    if (!routeMethods.has(route.method)) {
      fail(`Invalid route method in ${manifest.id}: ${String(route.method)}`);
    }
    if (!route.path.startsWith('/') || route.path.includes('?') || route.path.includes('#')) {
      fail(`Invalid route path in ${manifest.id}: ${route.path}`);
    }
  }
  for (const job of manifest.worker?.jobs ?? []) {
    validateContribution(job, `job kind in ${manifest.id}`);
  }
  for (const topic of manifest.worker?.subscriptions ?? []) {
    if (topic !== '*') validateContribution(topic, `event topic in ${manifest.id}`);
  }
  const subscriptions = manifest.worker?.subscriptions ?? [];
  if (new Set(subscriptions).size !== subscriptions.length) {
    fail(`Duplicate event subscription in extension ${manifest.id}`);
  }
  if (manifest.migrations) {
    validateIdentifier(manifest.migrations.sourceId, `migration source in ${manifest.id}`);
    for (const migration of manifest.migrations.migrations) {
      if (!migrationIdPattern.test(migration.id) || migration.id.includes('/')) {
        fail(`Invalid migration id in ${manifest.id}: ${migration.id}`);
      }
      for (const alias of migration.legacyAliases ?? []) {
        if (!alias || alias.includes('/') || alias.includes('\\')) {
          fail(`Invalid Legacy Alias in ${manifest.id}: ${alias}`);
        }
      }
    }
  }
}

function sortExtensions(
  extensions: readonly ExtensionDefinition[],
  byId: ReadonlyMap<string, ExtensionDefinition>,
): ExtensionDefinition[] {
  const inputOrder = new Map(extensions.map((extension, index) => [extension.manifest.id, index]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map(extensions.map((extension) => [extension.manifest.id, 0]));

  for (const extension of extensions) {
    const dependencies = [
      ...(extension.manifest.dependencies ?? []),
      ...(extension.manifest.optionalDependencies ?? []).filter((item) => byId.has(item.id)),
    ];
    for (const dependency of dependencies) {
      const installed = byId.get(dependency.id);
      if (!installed) {
        fail(`Extension ${extension.manifest.id} is missing dependency ${dependency.id}`);
      }
      if (!semver.satisfies(installed.manifest.version, dependency.version)) {
        fail(
          `Extension ${extension.manifest.id} requires ${dependency.id} ${dependency.version}, installed version is ${installed.manifest.version}`,
        );
      }
      outgoing.set(dependency.id, [...(outgoing.get(dependency.id) ?? []), extension.manifest.id]);
      indegree.set(extension.manifest.id, (indegree.get(extension.manifest.id) ?? 0) + 1);
    }
  }

  const ready = extensions
    .filter((extension) => indegree.get(extension.manifest.id) === 0)
    .map((extension) => extension.manifest.id);
  const sorted: ExtensionDefinition[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => inputOrder.get(left)! - inputOrder.get(right)!);
    const id = ready.shift()!;
    sorted.push(byId.get(id)!);
    for (const consumer of outgoing.get(id) ?? []) {
      const remaining = indegree.get(consumer)! - 1;
      indegree.set(consumer, remaining);
      if (remaining === 0) ready.push(consumer);
    }
  }

  if (sorted.length !== extensions.length) {
    const cycle = extensions
      .map((extension) => extension.manifest.id)
      .filter((id) => (indegree.get(id) ?? 0) > 0);
    fail(`Extension dependency cycle detected: ${cycle.join(', ')}`);
  }
  return sorted;
}

export function defineExtension<T extends ExtensionDefinition>(extension: T): T {
  return extension;
}

export function defineSystem(options: DefineSystemOptions): DefinedSystem {
  validateIdentifier(options.id, 'system id');
  validateVersion(options.version, `version for system ${options.id}`);
  const frameVersion = options.frameVersion ?? FRAME_VERSION;
  const apiVersion = options.extensionApiVersion ?? EXTENSION_API_VERSION;
  validateVersion(frameVersion, 'Frame version');
  if (!apiVersion.trim()) fail('Extension API version cannot be empty');

  const byId = new Map<string, ExtensionDefinition>();
  const permissions = new Map<string, string>();
  const settings = new Map<string, string>();
  const routes = new Map<string, string>();
  const jobs = new Map<string, string>();
  const migrationSources = new Map<string, string>();
  const migrations = new Map<string, string>();
  const legacyAliases = new Map<string, string>();

  for (const extension of options.extensions) {
    validateManifest(extension.manifest, frameVersion, apiVersion);
    const id = extension.manifest.id;
    if (byId.has(id)) fail(`Duplicate extension id: ${id}`);
    byId.set(id, extension);

    for (const permission of extension.manifest.permissions ?? []) {
      claim(permissions, permission, id, 'permission');
    }
    for (const setting of extension.manifest.settings ?? []) {
      claim(settings, setting, id, 'setting');
    }
    for (const route of extension.manifest.server?.routes ?? []) {
      claim(routes, `${route.method} ${route.path}`, id, 'route');
    }
    for (const job of extension.manifest.worker?.jobs ?? []) {
      claim(jobs, job, id, 'job kind');
    }
    if (extension.manifest.migrations) {
      const source = extension.manifest.migrations;
      claim(migrationSources, source.sourceId, id, 'migration source');
      for (const migration of source.migrations) {
        const canonicalId = `${source.sourceId}/${migration.id}`;
        claim(migrations, canonicalId, id, 'migration');
        for (const alias of migration.legacyAliases ?? []) {
          claim(legacyAliases, alias, canonicalId, 'Legacy Alias');
        }
      }
    }
  }

  const extensions = sortExtensions(options.extensions, byId);
  return Object.freeze({
    id: options.id,
    version: options.version,
    frameVersion,
    extensionApiVersion: apiVersion,
    extensions: Object.freeze([...extensions]),
  });
}
