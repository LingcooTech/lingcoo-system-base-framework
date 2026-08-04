import type { FastifyInstance } from 'fastify';

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

export interface ServerExtensionContext<TApp = FastifyInstance> {
  app: TApp;
}

export interface ServerExtensionSurface<TApp = FastifyInstance> {
  settings?: readonly ServerSettingDefinition[];
  register(context: ServerExtensionContext<TApp>): Promise<void> | void;
}

export function defineServerExtension<TApp = FastifyInstance>(
  surface: ServerExtensionSurface<TApp>,
): ServerExtensionSurface<TApp> {
  return surface;
}
