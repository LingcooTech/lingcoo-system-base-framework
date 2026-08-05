import semver from 'semver';

export const FRAME_VERSION = '0.4.0';
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

export interface ExtensionAdminRouteDeclaration {
  id: string;
  path: string;
  title: string;
  description?: string;
  permission: string;
}

export interface ExtensionAdminNavigationDeclaration {
  id: string;
  routeId: string;
  href: string;
  label: string;
  group: string;
  order?: number;
}

export interface ExtensionAdminDashboardWidgetDeclaration {
  id: string;
  title: string;
  permission?: string;
  order?: number;
}

export interface ExtensionAdminSearchProviderDeclaration {
  id: string;
  label: string;
  permission?: string;
}

export interface ExtensionAdminLandingBlockEditorDeclaration {
  type: string;
  label: string;
}

export interface ExtensionWebRouteDeclaration {
  id: string;
  path: string;
}

export interface ExtensionWebSeoDeclaration {
  id: string;
  routeId?: string;
}

export interface ExtensionWebSitemapDeclaration {
  id: string;
}

export interface ExtensionWebLandingBlockDeclaration {
  type: string;
  schemaVersion: number;
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
  admin?: {
    routes?: readonly ExtensionAdminRouteDeclaration[];
    navigation?: readonly ExtensionAdminNavigationDeclaration[];
    dashboardWidgets?: readonly ExtensionAdminDashboardWidgetDeclaration[];
    searchProviders?: readonly ExtensionAdminSearchProviderDeclaration[];
    landingBlockEditors?: readonly ExtensionAdminLandingBlockEditorDeclaration[];
  };
  web?: {
    routes?: readonly ExtensionWebRouteDeclaration[];
    seo?: readonly ExtensionWebSeoDeclaration[];
    sitemap?: readonly ExtensionWebSitemapDeclaration[];
    landingBlocks?: readonly ExtensionWebLandingBlockDeclaration[];
  };
}

export interface ExtensionDefinition {
  manifest: ExtensionManifest;
  server?: unknown;
  worker?: unknown;
  migrations?: unknown;
  admin?: unknown;
  web?: unknown;
}

export type ExtensionSurfaceName = 'server' | 'worker' | 'migrations' | 'admin' | 'web';

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

function validateFrontendPath(value: string, label: string, allowPattern: boolean): void {
  if (
    !value.startsWith('/') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\')
  ) {
    fail(`Invalid ${label}: ${value}`);
  }
  const segments = value.split('/').slice(1);
  for (const [index, segment] of segments.entries()) {
    if (!segment) continue;
    if (segment === '*') {
      if (!allowPattern || index !== segments.length - 1) fail(`Invalid ${label}: ${value}`);
      continue;
    }
    if (segment.startsWith(':')) {
      if (!allowPattern || !identifierPattern.test(segment.slice(1))) {
        fail(`Invalid ${label}: ${value}`);
      }
      continue;
    }
    if (segment.includes('*') || segment.includes(':')) fail(`Invalid ${label}: ${value}`);
  }
}

function routeClaimKey(path: string): string {
  return path
    .split('/')
    .map((segment) => (segment.startsWith(':') ? ':' : segment))
    .join('/');
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

  const adminRouteIds = new Set<string>();
  for (const route of manifest.admin?.routes ?? []) {
    validateContribution(route.id, `Admin route id in ${manifest.id}`);
    validateFrontendPath(route.path, `Admin route path in ${manifest.id}`, true);
    validateContribution(route.permission, `Admin route permission in ${manifest.id}`);
    if (!route.title.trim()) fail(`Admin route ${route.id} in ${manifest.id} requires a title`);
    if (adminRouteIds.has(route.id)) fail(`Duplicate Admin route id ${route.id} in ${manifest.id}`);
    adminRouteIds.add(route.id);
  }
  for (const navigation of manifest.admin?.navigation ?? []) {
    validateContribution(navigation.id, `Admin navigation id in ${manifest.id}`);
    validateContribution(navigation.routeId, `Admin navigation route in ${manifest.id}`);
    validateFrontendPath(navigation.href, `Admin navigation href in ${manifest.id}`, false);
    if (!adminRouteIds.has(navigation.routeId)) {
      fail(
        `Admin navigation ${navigation.id} in ${manifest.id} references unknown route ${navigation.routeId}`,
      );
    }
    if (!navigation.label.trim() || !navigation.group.trim()) {
      fail(`Admin navigation ${navigation.id} in ${manifest.id} requires a label and group`);
    }
    if (navigation.order !== undefined && !Number.isFinite(navigation.order)) {
      fail(`Invalid Admin navigation order in ${manifest.id}: ${navigation.id}`);
    }
  }
  for (const widget of manifest.admin?.dashboardWidgets ?? []) {
    validateContribution(widget.id, `Admin Dashboard Widget id in ${manifest.id}`);
    if (!widget.title.trim()) fail(`Admin Dashboard Widget ${widget.id} requires a title`);
    if (widget.permission) {
      validateContribution(
        widget.permission,
        `Admin Dashboard Widget permission in ${manifest.id}`,
      );
    }
    if (widget.order !== undefined && !Number.isFinite(widget.order)) {
      fail(`Invalid Admin Dashboard Widget order in ${manifest.id}: ${widget.id}`);
    }
  }
  for (const provider of manifest.admin?.searchProviders ?? []) {
    validateContribution(provider.id, `Admin search provider id in ${manifest.id}`);
    if (!provider.label.trim()) fail(`Admin search provider ${provider.id} requires a label`);
    if (provider.permission) {
      validateContribution(
        provider.permission,
        `Admin search provider permission in ${manifest.id}`,
      );
    }
  }

  const webRouteIds = new Set<string>();
  for (const route of manifest.web?.routes ?? []) {
    validateContribution(route.id, `Web route id in ${manifest.id}`);
    validateFrontendPath(route.path, `Web route path in ${manifest.id}`, true);
    if (webRouteIds.has(route.id)) fail(`Duplicate Web route id ${route.id} in ${manifest.id}`);
    webRouteIds.add(route.id);
  }
  for (const seo of manifest.web?.seo ?? []) {
    validateContribution(seo.id, `Web SEO id in ${manifest.id}`);
    if (seo.routeId && !webRouteIds.has(seo.routeId)) {
      fail(`Web SEO ${seo.id} in ${manifest.id} references unknown route ${seo.routeId}`);
    }
  }
  for (const sitemap of manifest.web?.sitemap ?? []) {
    validateContribution(sitemap.id, `Web Sitemap id in ${manifest.id}`);
  }
  const landingBlockTypes = new Set<string>();
  for (const block of manifest.web?.landingBlocks ?? []) {
    validateContribution(block.type, `Landing Block type in ${manifest.id}`);
    if (!Number.isSafeInteger(block.schemaVersion) || block.schemaVersion < 1) {
      fail(`Invalid Landing Block schema version in ${manifest.id}: ${block.type}`);
    }
    if (landingBlockTypes.has(block.type)) {
      fail(`Duplicate Landing Block type ${block.type} in ${manifest.id}`);
    }
    landingBlockTypes.add(block.type);
  }
  for (const editor of manifest.admin?.landingBlockEditors ?? []) {
    validateContribution(editor.type, `Landing Block editor type in ${manifest.id}`);
    if (!editor.label.trim()) fail(`Landing Block editor ${editor.type} requires a label`);
    if (!landingBlockTypes.has(editor.type)) {
      fail(`Landing Block editor ${editor.type} in ${manifest.id} has no matching Web declaration`);
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

export function projectExtensionManifest(
  manifest: ExtensionManifest,
  surfaces: readonly ExtensionSurfaceName[],
): ExtensionManifest {
  const selected = new Set(surfaces);
  return {
    id: manifest.id,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    frame: manifest.frame,
    dependencies: manifest.dependencies,
    optionalDependencies: manifest.optionalDependencies,
    permissions: manifest.permissions,
    settings: manifest.settings,
    server: selected.has('server') ? manifest.server : undefined,
    worker: selected.has('worker') ? manifest.worker : undefined,
    migrations: selected.has('migrations') ? manifest.migrations : undefined,
    admin: selected.has('admin') ? manifest.admin : undefined,
    web: selected.has('web')
      ? manifest.web
      : selected.has('admin') && (manifest.admin?.landingBlockEditors?.length ?? 0) > 0
        ? { landingBlocks: manifest.web?.landingBlocks }
        : undefined,
  };
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
  const adminRouteIds = new Map<string, string>();
  const adminRoutes = new Map<string, string>();
  const adminNavigation = new Map<string, string>();
  const adminWidgets = new Map<string, string>();
  const adminSearchProviders = new Map<string, string>();
  const landingBlockEditors = new Map<string, string>();
  const webRouteIds = new Map<string, string>();
  const webRoutes = new Map<string, string>();
  const webSeo = new Map<string, string>();
  const webSitemap = new Map<string, string>();
  const landingBlocks = new Map<string, string>();

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
    for (const route of extension.manifest.admin?.routes ?? []) {
      claim(adminRouteIds, route.id, id, 'Admin route id');
      claim(adminRoutes, routeClaimKey(route.path), id, 'Admin route');
    }
    for (const navigation of extension.manifest.admin?.navigation ?? []) {
      claim(adminNavigation, navigation.id, id, 'Admin navigation');
    }
    for (const widget of extension.manifest.admin?.dashboardWidgets ?? []) {
      claim(adminWidgets, widget.id, id, 'Admin Dashboard Widget');
    }
    for (const provider of extension.manifest.admin?.searchProviders ?? []) {
      claim(adminSearchProviders, provider.id, id, 'Admin search provider');
    }
    for (const editor of extension.manifest.admin?.landingBlockEditors ?? []) {
      claim(landingBlockEditors, editor.type, id, 'Landing Block editor');
    }
    for (const route of extension.manifest.web?.routes ?? []) {
      claim(webRouteIds, route.id, id, 'Web route id');
      claim(webRoutes, routeClaimKey(route.path), id, 'Web route');
    }
    for (const seo of extension.manifest.web?.seo ?? []) {
      claim(webSeo, seo.id, id, 'Web SEO contribution');
    }
    for (const sitemap of extension.manifest.web?.sitemap ?? []) {
      claim(webSitemap, sitemap.id, id, 'Web Sitemap contribution');
    }
    for (const block of extension.manifest.web?.landingBlocks ?? []) {
      claim(landingBlocks, block.type, id, 'Landing Block type');
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
