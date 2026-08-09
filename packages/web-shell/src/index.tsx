import type {
  DefinedSystem,
  ExtensionDefinition,
  ExtensionWebLandingBlockDeclaration,
  ExtensionWebRouteDeclaration,
  ExtensionWebSeoDeclaration,
  ExtensionWebSitemapDeclaration,
} from '@lingcootech/frame-extension-sdk';
import {
  createContext,
  createElement,
  useContext,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { ZodType } from 'zod';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface WebRouteContext<TContext = unknown> {
  context: TContext;
  params: Readonly<Record<string, string>>;
  pathname: string;
  searchParams: URLSearchParams;
}

export type WebRouteComponent<TContext = unknown> = ComponentType<WebRouteContext<TContext>>;

export interface WebSeoData {
  title?: string;
  description?: string;
  canonicalPath?: string;
  imageUrl?: string;
  noIndex?: boolean;
  structuredData?: JsonValue;
}

export interface WebSitemapEntry {
  path: string;
  lastModified?: string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface LandingBlockAssetReference {
  assetId: string;
  role: string;
}

export interface LandingBlockMigration {
  from: number;
  to: number;
  migrate(config: JsonValue): JsonValue;
}

export interface LandingBlockDefinition<TConfig = unknown, TContext = unknown> {
  type: string;
  schemaVersion: number;
  schema: ZodType<TConfig>;
  renderer: ComponentType<{
    config: TConfig;
    context: TContext;
    instanceId: string;
  }>;
  assets(config: TConfig): readonly LandingBlockAssetReference[];
  migrations?: readonly LandingBlockMigration[];
}

export interface StoredLandingBlock {
  id: string;
  type: string;
  schemaVersion: number;
  config: JsonValue;
}

export interface PreparedLandingBlock<TConfig = unknown, TContext = unknown> {
  id: string;
  type: string;
  schemaVersion: number;
  config: TConfig;
  assets: readonly LandingBlockAssetReference[];
  renderer: LandingBlockDefinition<TConfig, TContext>['renderer'];
}

export interface WebExtensionSurface<TContext = unknown> {
  routes?: readonly { id: string; component: WebRouteComponent<TContext> }[];
  seo?: readonly {
    id: string;
    resolve(context: WebRouteContext<TContext>): WebSeoData | Promise<WebSeoData>;
  }[];
  sitemap?: readonly {
    id: string;
    collect(context: TContext): readonly WebSitemapEntry[] | Promise<readonly WebSitemapEntry[]>;
  }[];
  landingBlocks?: readonly LandingBlockDefinition<unknown, TContext>[];
}

export function defineWebExtension<TContext = unknown>(
  surface: WebExtensionSurface<TContext>,
): WebExtensionSurface<TContext> {
  return surface;
}

export function defineLandingBlock<TConfig, TContext = unknown>(
  block: LandingBlockDefinition<TConfig, TContext>,
): LandingBlockDefinition<unknown, TContext> {
  return block as unknown as LandingBlockDefinition<unknown, TContext>;
}

export interface RegisteredWebRoute<TContext = unknown> extends ExtensionWebRouteDeclaration {
  extensionId: string;
  component: WebRouteComponent<TContext>;
}

export interface RegisteredWebSeo<TContext = unknown> extends ExtensionWebSeoDeclaration {
  extensionId: string;
  resolve(context: WebRouteContext<TContext>): WebSeoData | Promise<WebSeoData>;
}

export interface RegisteredWebSitemap<TContext = unknown> extends ExtensionWebSitemapDeclaration {
  extensionId: string;
  collect(context: TContext): readonly WebSitemapEntry[] | Promise<readonly WebSitemapEntry[]>;
}

export interface RegisteredLandingBlock<
  TContext = unknown,
> extends ExtensionWebLandingBlockDeclaration {
  extensionId: string;
  definition: LandingBlockDefinition<unknown, TContext>;
}

export interface WebRouteMatch<TContext = unknown> {
  route: RegisteredWebRoute<TContext>;
  params: Readonly<Record<string, string>>;
}

export interface WebRegistry<TContext = unknown> {
  readonly routes: readonly RegisteredWebRoute<TContext>[];
  readonly seo: readonly RegisteredWebSeo<TContext>[];
  readonly sitemap: readonly RegisteredWebSitemap<TContext>[];
  readonly landingBlocks: readonly RegisteredLandingBlock<TContext>[];
  matchRoute(pathname: string): WebRouteMatch<TContext> | undefined;
  resolveSeo(id: string, context: WebRouteContext<TContext>): Promise<WebSeoData | undefined>;
  collectSitemap(context: TContext): Promise<readonly WebSitemapEntry[]>;
  prepareLandingBlock(block: StoredLandingBlock): PreparedLandingBlock<unknown, TContext>;
}

function runtimeSurface<TContext>(
  extension: ExtensionDefinition,
): WebExtensionSurface<TContext> | undefined {
  return extension.web as WebExtensionSurface<TContext> | undefined;
}

function indexRuntime<T extends { id: string }>(
  values: readonly T[] | undefined,
  extensionId: string,
  contribution: string,
): Map<string, T> {
  const indexed = new Map<string, T>();
  for (const value of values ?? []) {
    if (indexed.has(value.id)) {
      throw new Error(`Extension ${extensionId} registered duplicate ${contribution} ${value.id}`);
    }
    indexed.set(value.id, value);
  }
  return indexed;
}

function bindDeclared<TDeclaration extends { id: string }, TRuntime extends { id: string }>(
  declarations: readonly TDeclaration[] | undefined,
  runtime: Map<string, TRuntime>,
  extensionId: string,
  contribution: string,
): Array<TDeclaration & TRuntime> {
  const declared = new Set((declarations ?? []).map((item) => item.id));
  for (const id of runtime.keys()) {
    if (!declared.has(id)) {
      throw new Error(`Extension ${extensionId} registered undeclared ${contribution} ${id}`);
    }
  }
  return (declarations ?? []).map((declaration) => {
    const value = runtime.get(declaration.id);
    if (!value) {
      throw new Error(
        `Extension ${extensionId} did not register declared ${contribution} ${declaration.id}`,
      );
    }
    return { ...declaration, ...value };
  });
}

function matchPath(
  pattern: string,
  pathname: string,
): Readonly<Record<string, string>> | undefined {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index += 1) {
    const expected = patternSegments[index]!;
    if (expected === '*') return Object.freeze(params);
    const actual = pathSegments[index];
    if (actual === undefined) return undefined;
    if (expected.startsWith(':')) {
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return undefined;
      }
    } else if (expected !== actual) return undefined;
  }
  return patternSegments.length === pathSegments.length ? Object.freeze(params) : undefined;
}

function routeSpecificity(path: string): number {
  return path
    .split('/')
    .filter(Boolean)
    .reduce(
      (score, segment) => score + (segment === '*' ? 0 : segment.startsWith(':') ? 1 : 10),
      0,
    );
}

function assertJsonValue(value: unknown, path = 'config'): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) assertJsonValue(item, `${path}.${key}`);
    return;
  }
  throw new Error(`Landing Block ${path} must contain JSON data only`);
}

function validateLandingBlockDefinition<TContext>(
  extensionId: string,
  definition: LandingBlockDefinition<unknown, TContext>,
): void {
  const migrationStarts = new Set<number>();
  for (const migration of definition.migrations ?? []) {
    if (
      !Number.isSafeInteger(migration.from) ||
      !Number.isSafeInteger(migration.to) ||
      migration.from < 1 ||
      migration.to <= migration.from ||
      migration.to > definition.schemaVersion
    ) {
      throw new Error(
        `Extension ${extensionId} registered an invalid migration for Landing Block ${definition.type}`,
      );
    }
    if (migrationStarts.has(migration.from)) {
      throw new Error(
        `Extension ${extensionId} registered duplicate migrations from version ${migration.from} for Landing Block ${definition.type}`,
      );
    }
    migrationStarts.add(migration.from);
  }
}

export function createWebRegistry<TContext = unknown>(
  system: DefinedSystem,
): WebRegistry<TContext> {
  const routes: RegisteredWebRoute<TContext>[] = [];
  const seo: RegisteredWebSeo<TContext>[] = [];
  const sitemap: RegisteredWebSitemap<TContext>[] = [];
  const landingBlocks: RegisteredLandingBlock<TContext>[] = [];

  for (const extension of system.extensions) {
    const manifest = extension.manifest.web;
    const surface = runtimeSurface<TContext>(extension);
    const hasDeclarations = Object.values(manifest ?? {}).some((items) => (items?.length ?? 0) > 0);
    if (hasDeclarations && !surface) {
      throw new Error(
        `Extension ${extension.manifest.id} declares Web contributions without a surface`,
      );
    }
    if (!surface) continue;
    const extensionId = extension.manifest.id;

    routes.push(
      ...bindDeclared(
        manifest?.routes,
        indexRuntime(surface.routes, extensionId, 'Web route'),
        extensionId,
        'Web route',
      ).map((item) => ({ ...item, extensionId })),
    );
    seo.push(
      ...bindDeclared(
        manifest?.seo,
        indexRuntime(surface.seo, extensionId, 'Web SEO contribution'),
        extensionId,
        'Web SEO contribution',
      ).map((item) => ({ ...item, extensionId })),
    );
    sitemap.push(
      ...bindDeclared(
        manifest?.sitemap,
        indexRuntime(surface.sitemap, extensionId, 'Web Sitemap contribution'),
        extensionId,
        'Web Sitemap contribution',
      ).map((item) => ({ ...item, extensionId })),
    );

    const runtimeBlocks = new Map(
      (surface.landingBlocks ?? []).map((block) => [block.type, block]),
    );
    if (runtimeBlocks.size !== (surface.landingBlocks?.length ?? 0)) {
      throw new Error(`Extension ${extensionId} registered a duplicate Landing Block type`);
    }
    const declaredTypes = new Set((manifest?.landingBlocks ?? []).map((block) => block.type));
    for (const type of runtimeBlocks.keys()) {
      if (!declaredTypes.has(type)) {
        throw new Error(`Extension ${extensionId} registered undeclared Landing Block ${type}`);
      }
    }
    for (const declaration of manifest?.landingBlocks ?? []) {
      const definition = runtimeBlocks.get(declaration.type);
      if (!definition) {
        throw new Error(
          `Extension ${extensionId} did not register declared Landing Block ${declaration.type}`,
        );
      }
      if (definition.schemaVersion !== declaration.schemaVersion) {
        throw new Error(
          `Landing Block ${declaration.type} runtime schema version does not match its Manifest`,
        );
      }
      validateLandingBlockDefinition(extensionId, definition);
      landingBlocks.push({ ...declaration, extensionId, definition });
    }
  }

  const matchOrder = routes
    .map((route, index) => ({ route, index }))
    .sort(
      (left, right) =>
        routeSpecificity(right.route.path) - routeSpecificity(left.route.path) ||
        left.index - right.index,
    );
  const seoById = new Map(seo.map((item) => [item.id, item]));
  const blockByType = new Map(landingBlocks.map((item) => [item.type, item]));

  return Object.freeze({
    routes: Object.freeze(routes),
    seo: Object.freeze(seo),
    sitemap: Object.freeze(sitemap),
    landingBlocks: Object.freeze(landingBlocks),
    matchRoute(pathname: string) {
      for (const { route } of matchOrder) {
        const params = matchPath(route.path, pathname);
        if (params) return { route, params };
      }
      return undefined;
    },
    async resolveSeo(id: string, context: WebRouteContext<TContext>) {
      return seoById.get(id)?.resolve(context);
    },
    async collectSitemap(context: TContext) {
      const groups = await Promise.all(sitemap.map((item) => item.collect(context)));
      return Object.freeze(groups.flat());
    },
    prepareLandingBlock(block: StoredLandingBlock) {
      assertJsonValue(block.config);
      const registered = blockByType.get(block.type);
      if (!registered) throw new Error(`Unknown Landing Block type: ${block.type}`);
      if (!Number.isSafeInteger(block.schemaVersion) || block.schemaVersion < 1) {
        throw new Error(`Invalid stored schema version for Landing Block ${block.type}`);
      }
      if (block.schemaVersion > registered.schemaVersion) {
        throw new Error(
          `Landing Block ${block.type} uses future schema version ${block.schemaVersion}`,
        );
      }
      let version = block.schemaVersion;
      let config: JsonValue = block.config;
      while (version < registered.schemaVersion) {
        const migration = registered.definition.migrations?.find((item) => item.from === version);
        if (!migration || migration.to <= version || migration.to > registered.schemaVersion) {
          throw new Error(
            `Landing Block ${block.type} has no migration from schema version ${version}`,
          );
        }
        config = migration.migrate(config);
        assertJsonValue(config);
        version = migration.to;
      }
      const parsed = registered.definition.schema.parse(config);
      const assets = registered.definition.assets(parsed);
      for (const asset of assets) {
        if (!asset.assetId.trim() || !asset.role.trim()) {
          throw new Error(`Landing Block ${block.type} returned an invalid asset reference`);
        }
      }
      return {
        id: block.id,
        type: block.type,
        schemaVersion: registered.schemaVersion,
        config: parsed,
        assets: Object.freeze([...assets]),
        renderer: registered.definition.renderer,
      };
    },
  });
}

const WebRegistryContext = createContext<WebRegistry<unknown> | null>(null);

export function WebShell<TContext>({
  children,
  registry,
}: {
  children: ReactNode;
  registry: WebRegistry<TContext>;
}) {
  return (
    <WebRegistryContext.Provider value={registry as WebRegistry<unknown>}>
      {children}
    </WebRegistryContext.Provider>
  );
}

export function useWebRegistry<TContext = unknown>(): WebRegistry<TContext> {
  const registry = useContext(WebRegistryContext);
  if (!registry) throw new Error('useWebRegistry must be used inside WebShell');
  return registry as WebRegistry<TContext>;
}

export function WebRouteSlot<TContext>({
  context,
  notFound = null,
  pathname,
  searchParams = new URLSearchParams(),
}: {
  context: TContext;
  notFound?: ReactNode;
  pathname: string;
  searchParams?: URLSearchParams;
}) {
  const registry = useWebRegistry<TContext>();
  const match = registry.matchRoute(pathname);
  if (!match) return notFound;
  return createElement(match.route.component, {
    context,
    params: match.params,
    pathname,
    searchParams,
  });
}

export function LandingBlockRenderer<TContext>({
  block,
  context,
}: {
  block: StoredLandingBlock;
  context: TContext;
}) {
  const registry = useWebRegistry<TContext>();
  const prepared = registry.prepareLandingBlock(block);
  return createElement(prepared.renderer, {
    config: prepared.config,
    context,
    instanceId: prepared.id,
  });
}
