export type ExtensionEnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface ExtensionEnvironmentContext {
  nodeEnv: 'development' | 'test' | 'production';
}

export interface EnvironmentExtensionSurface<TEnvironment = unknown> {
  variables: readonly string[];
  parse(source: ExtensionEnvironmentSource, context: ExtensionEnvironmentContext): TEnvironment;
}

export interface ExtensionEnvironmentValues {
  has(extensionId: string): boolean;
  get<TEnvironment = unknown>(extensionId: string): TEnvironment | undefined;
  require<TEnvironment = unknown>(extensionId: string): TEnvironment;
}

export function defineEnvironmentExtension<TEnvironment>(
  surface: EnvironmentExtensionSurface<TEnvironment>,
): EnvironmentExtensionSurface<TEnvironment> {
  return surface;
}
