import type { ExtensionEnvironmentSource } from '@lingcootech/frame-extension-sdk/environment';

const sources = new WeakMap<object, ExtensionEnvironmentSource>();

export function attachEnvironmentSource<TEnvironment extends object>(
  environment: TEnvironment,
  source: ExtensionEnvironmentSource,
): TEnvironment {
  sources.set(environment, Object.freeze({ ...source }));
  return environment;
}

export function readEnvironmentSource(environment: object): ExtensionEnvironmentSource {
  const source = sources.get(environment);
  if (!source) {
    throw new Error('AppEnv must be created by loadEnv before composing extension environments');
  }
  return source;
}
