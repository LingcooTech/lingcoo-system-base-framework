import type {
  DefinedSystem,
  ExtensionAdminDashboardWidgetDeclaration,
  ExtensionAdminLandingBlockEditorDeclaration,
  ExtensionAdminNavigationDeclaration,
  ExtensionAdminRouteDeclaration,
  ExtensionAdminSearchProviderDeclaration,
  ExtensionDefinition,
} from '@lingcoo/frame-extension-sdk';
import {
  createContext,
  createElement,
  useContext,
  type ComponentType,
  type ReactNode,
} from 'react';

export interface AdminRouteContext<TContext = unknown> {
  context: TContext;
  params: Readonly<Record<string, string>>;
  pathname: string;
  searchParams: URLSearchParams;
}

export type AdminRouteComponent<TContext = unknown> = ComponentType<AdminRouteContext<TContext>>;

export interface AdminNavigationRuntimeContribution {
  id: string;
  icon?: ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;
}

export interface AdminSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  kind?: string;
}

export interface AdminSearchGroup {
  id: string;
  label: string;
  items: readonly AdminSearchItem[];
}

export interface AdminSearchContext<TContext = unknown> {
  context: TContext;
  query: string;
  signal?: AbortSignal;
}

export interface AdminExtensionSurface<TContext = unknown> {
  routes?: readonly { id: string; component: AdminRouteComponent<TContext> }[];
  navigation?: readonly AdminNavigationRuntimeContribution[];
  dashboardWidgets?: readonly {
    id: string;
    component: ComponentType<{ context: TContext }>;
  }[];
  searchProviders?: readonly {
    id: string;
    search(context: AdminSearchContext<TContext>): Promise<readonly AdminSearchGroup[]>;
  }[];
  landingBlockEditors?: readonly {
    type: string;
    component: ComponentType<{
      context: TContext;
      value: unknown;
      onChange(value: unknown): void;
    }>;
  }[];
}

export function defineAdminExtension<TContext = unknown>(
  surface: AdminExtensionSurface<TContext>,
): AdminExtensionSurface<TContext> {
  return surface;
}

export interface RegisteredAdminRoute<TContext = unknown> extends ExtensionAdminRouteDeclaration {
  extensionId: string;
  component: AdminRouteComponent<TContext>;
}

export interface RegisteredAdminNavigation<
  TContext = unknown,
> extends ExtensionAdminNavigationDeclaration {
  extensionId: string;
  route: RegisteredAdminRoute<TContext>;
  icon?: AdminNavigationRuntimeContribution['icon'];
}

export interface RegisteredAdminDashboardWidget<
  TContext = unknown,
> extends ExtensionAdminDashboardWidgetDeclaration {
  extensionId: string;
  component: ComponentType<{ context: TContext }>;
}

export interface RegisteredAdminSearchProvider<
  TContext = unknown,
> extends ExtensionAdminSearchProviderDeclaration {
  extensionId: string;
  search(context: AdminSearchContext<TContext>): Promise<readonly AdminSearchGroup[]>;
}

export interface RegisteredAdminLandingBlockEditor<
  TContext = unknown,
> extends ExtensionAdminLandingBlockEditorDeclaration {
  extensionId: string;
  component: ComponentType<{
    context: TContext;
    value: unknown;
    onChange(value: unknown): void;
  }>;
}

export interface AdminRouteMatch<TContext = unknown> {
  route: RegisteredAdminRoute<TContext>;
  params: Readonly<Record<string, string>>;
}

export interface AdminRegistry<TContext = unknown> {
  readonly routes: readonly RegisteredAdminRoute<TContext>[];
  readonly navigation: readonly RegisteredAdminNavigation<TContext>[];
  readonly dashboardWidgets: readonly RegisteredAdminDashboardWidget<TContext>[];
  readonly searchProviders: readonly RegisteredAdminSearchProvider<TContext>[];
  readonly landingBlockEditors: readonly RegisteredAdminLandingBlockEditor<TContext>[];
  matchRoute(pathname: string): AdminRouteMatch<TContext> | undefined;
  getLandingBlockEditor(type: string): RegisteredAdminLandingBlockEditor<TContext> | undefined;
}

function runtimeSurface<TContext>(
  extension: ExtensionDefinition,
): AdminExtensionSurface<TContext> | undefined {
  return extension.admin as AdminExtensionSurface<TContext> | undefined;
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

export function createAdminRegistry<TContext = unknown>(
  system: DefinedSystem,
): AdminRegistry<TContext> {
  const routes: RegisteredAdminRoute<TContext>[] = [];
  const navigation: RegisteredAdminNavigation<TContext>[] = [];
  const dashboardWidgets: RegisteredAdminDashboardWidget<TContext>[] = [];
  const searchProviders: RegisteredAdminSearchProvider<TContext>[] = [];
  const landingBlockEditors: RegisteredAdminLandingBlockEditor<TContext>[] = [];

  for (const extension of system.extensions) {
    const manifest = extension.manifest.admin;
    const surface = runtimeSurface<TContext>(extension);
    const hasDeclarations = Object.values(manifest ?? {}).some((items) => (items?.length ?? 0) > 0);
    if (hasDeclarations && !surface) {
      throw new Error(
        `Extension ${extension.manifest.id} declares Admin contributions without a surface`,
      );
    }
    if (!surface) continue;

    const extensionId = extension.manifest.id;
    const boundRoutes = bindDeclared(
      manifest?.routes,
      indexRuntime(surface.routes, extensionId, 'Admin route'),
      extensionId,
      'Admin route',
    ).map((route) => ({ ...route, extensionId }));
    routes.push(...boundRoutes);
    const routeById = new Map(boundRoutes.map((route) => [route.id, route]));

    const boundNavigation = bindDeclared(
      manifest?.navigation,
      indexRuntime(surface.navigation, extensionId, 'Admin navigation'),
      extensionId,
      'Admin navigation',
    ).map((item) => {
      const route = routeById.get(item.routeId);
      if (!route) throw new Error(`Admin navigation ${item.id} has no registered route`);
      return { ...item, extensionId, route };
    });
    navigation.push(...boundNavigation);
    dashboardWidgets.push(
      ...bindDeclared(
        manifest?.dashboardWidgets,
        indexRuntime(surface.dashboardWidgets, extensionId, 'Admin Dashboard Widget'),
        extensionId,
        'Admin Dashboard Widget',
      ).map((item) => ({ ...item, extensionId })),
    );
    searchProviders.push(
      ...bindDeclared(
        manifest?.searchProviders,
        indexRuntime(surface.searchProviders, extensionId, 'Admin search provider'),
        extensionId,
        'Admin search provider',
      ).map((item) => ({ ...item, extensionId })),
    );

    const editorRuntime = new Map(
      (surface.landingBlockEditors ?? []).map((editor) => [editor.type, editor]),
    );
    if (editorRuntime.size !== (surface.landingBlockEditors?.length ?? 0)) {
      throw new Error(`Extension ${extensionId} registered a duplicate Landing Block editor`);
    }
    const declaredEditorTypes = new Set(
      (manifest?.landingBlockEditors ?? []).map((editor) => editor.type),
    );
    for (const type of editorRuntime.keys()) {
      if (!declaredEditorTypes.has(type)) {
        throw new Error(
          `Extension ${extensionId} registered undeclared Landing Block editor ${type}`,
        );
      }
    }
    for (const declaration of manifest?.landingBlockEditors ?? []) {
      const editor = editorRuntime.get(declaration.type);
      if (!editor) {
        throw new Error(
          `Extension ${extensionId} did not register declared Landing Block editor ${declaration.type}`,
        );
      }
      landingBlockEditors.push({ ...declaration, ...editor, extensionId });
    }
  }

  navigation.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  dashboardWidgets.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const matchOrder = routes
    .map((route, index) => ({ route, index }))
    .sort(
      (left, right) =>
        routeSpecificity(right.route.path) - routeSpecificity(left.route.path) ||
        left.index - right.index,
    );
  const editorByType = new Map(landingBlockEditors.map((editor) => [editor.type, editor]));

  return Object.freeze({
    routes: Object.freeze(routes),
    navigation: Object.freeze(navigation),
    dashboardWidgets: Object.freeze(dashboardWidgets),
    searchProviders: Object.freeze(searchProviders),
    landingBlockEditors: Object.freeze(landingBlockEditors),
    matchRoute(pathname: string) {
      for (const { route } of matchOrder) {
        const params = matchPath(route.path, pathname);
        if (params) return { route, params };
      }
      return undefined;
    },
    getLandingBlockEditor(type: string) {
      return editorByType.get(type);
    },
  });
}

const AdminRegistryContext = createContext<AdminRegistry<unknown> | null>(null);

export function AdminShell<TContext>({
  children,
  registry,
}: {
  children: ReactNode;
  registry: AdminRegistry<TContext>;
}) {
  return (
    <AdminRegistryContext.Provider value={registry as AdminRegistry<unknown>}>
      {children}
    </AdminRegistryContext.Provider>
  );
}

export function useAdminRegistry<TContext = unknown>(): AdminRegistry<TContext> {
  const registry = useContext(AdminRegistryContext);
  if (!registry) throw new Error('useAdminRegistry must be used inside AdminShell');
  return registry as AdminRegistry<TContext>;
}

export function AdminRouteSlot<TContext>({
  context,
  forbidden,
  hasPermission,
  notFound = null,
  pathname,
  searchParams = new URLSearchParams(),
}: {
  context: TContext;
  forbidden?: ReactNode;
  hasPermission(permission: string): boolean;
  notFound?: ReactNode;
  pathname: string;
  searchParams?: URLSearchParams;
}) {
  const registry = useAdminRegistry<TContext>();
  const match = registry.matchRoute(pathname);
  if (!match) return notFound;
  if (!hasPermission(match.route.permission)) return forbidden ?? notFound;
  return createElement(match.route.component, {
    context,
    params: match.params,
    pathname,
    searchParams,
  });
}

export function AdminDashboardWidgets<TContext>({
  context,
  hasPermission,
}: {
  context: TContext;
  hasPermission(permission: string): boolean;
}) {
  const registry = useAdminRegistry<TContext>();
  return registry.dashboardWidgets
    .filter((widget) => !widget.permission || hasPermission(widget.permission))
    .map((widget) => createElement(widget.component, { context, key: widget.id }));
}
