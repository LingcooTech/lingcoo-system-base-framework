export interface ServerRequest {
  readonly body?: unknown;
  readonly params?: unknown;
  readonly query?: unknown;
}

export interface ServerReply {
  code(statusCode: number): ServerReply;
  send(payload?: unknown): unknown;
}

export type ServerRouteHandler = (
  request: ServerRequest,
  reply: ServerReply,
) => unknown | Promise<unknown>;

/** Minimal HTTP registration contract shared by Host adapters. */
export interface ServerApplication {
  get(path: string, handler: ServerRouteHandler): unknown;
  post(path: string, handler: ServerRouteHandler): unknown;
  put(path: string, handler: ServerRouteHandler): unknown;
  patch(path: string, handler: ServerRouteHandler): unknown;
  delete(path: string, handler: ServerRouteHandler): unknown;
}

export interface SettingValueSchema {
  parse(value: unknown): string;
}

export interface ServerSettingOption {
  label: string;
  value: string;
}

export interface ServerSettingDefinition {
  key: string;
  group: string;
  groupLabel: string;
  label: string;
  description: string;
  type: 'text' | 'email' | 'url' | 'select';
  defaultValue: string;
  options?: readonly ServerSettingOption[];
  schema: SettingValueSchema;
}

export interface ServerExtensionContext<TApp = ServerApplication> {
  app: TApp;
}

/**
 * The runtime value behind a capability declared in the extension manifest.
 * Its version is intentionally kept in the manifest so composition metadata
 * remains serializable and can be inspected without loading Server code.
 */
export interface ServerCapabilityImplementation<T = unknown> {
  id: string;
  value: T;
}

export interface ServerExtensionSurface<TApp = ServerApplication> {
  settings?: readonly ServerSettingDefinition[];
  capabilities?: readonly ServerCapabilityImplementation[];
  register(context: ServerExtensionContext<TApp>): Promise<void> | void;
}

export function defineServerExtension<TApp = ServerApplication>(
  surface: ServerExtensionSurface<TApp>,
): ServerExtensionSurface<TApp> {
  return surface;
}
