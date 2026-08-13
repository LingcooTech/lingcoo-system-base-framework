import type { DefinedSystem, ExtensionDefinition } from '@lingcootech/frame-extension-sdk';
import type {
  EnvironmentExtensionSurface,
  ExtensionEnvironmentSource,
  ExtensionEnvironmentValues,
} from '@lingcootech/frame-extension-sdk/environment';

export interface SystemEnvironmentVariableDescriptor {
  name: string;
  sensitive: boolean;
}

export interface SystemEnvironmentDescriptor {
  extensionId: string;
  variables: readonly SystemEnvironmentVariableDescriptor[];
}

export interface SystemEnvironmentRegistration<
  TEnvironment = unknown,
> extends SystemEnvironmentDescriptor {
  value: TEnvironment;
  sensitiveValues: readonly string[];
}

interface SystemEnvironmentEntry extends SystemEnvironmentRegistration {
  value: unknown;
}

const registrySensitiveValues = new WeakMap<SystemEnvironmentRegistry, readonly string[]>();

function environmentSurface(
  extension: ExtensionDefinition,
): EnvironmentExtensionSurface | undefined {
  return extension.environment as EnvironmentExtensionSurface | undefined;
}

export class SystemEnvironmentRegistry implements ExtensionEnvironmentValues {
  readonly #entries: ReadonlyMap<string, SystemEnvironmentEntry>;

  constructor(entries: readonly SystemEnvironmentRegistration[]) {
    const byExtensionId = new Map<string, SystemEnvironmentEntry>();
    for (const entry of entries) {
      if (byExtensionId.has(entry.extensionId)) {
        throw new Error(`Duplicate extension environment ${entry.extensionId}`);
      }
      byExtensionId.set(entry.extensionId, { ...entry });
    }
    this.#entries = byExtensionId;
    registrySensitiveValues.set(
      this,
      entries.flatMap((entry) => entry.sensitiveValues),
    );
  }

  has(extensionId: string): boolean {
    return this.#entries.has(extensionId);
  }

  get<TEnvironment = unknown>(extensionId: string): TEnvironment | undefined {
    return this.#entries.get(extensionId)?.value as TEnvironment | undefined;
  }

  require<TEnvironment = unknown>(extensionId: string): TEnvironment {
    const entry = this.#entries.get(extensionId);
    if (!entry) throw new Error(`Extension environment ${extensionId} is not installed`);
    return entry.value as TEnvironment;
  }

  describe(): readonly SystemEnvironmentDescriptor[] {
    return [...this.#entries.values()].map(({ extensionId, variables }) => ({
      extensionId,
      variables: variables.map((variable) => ({ ...variable })),
    }));
  }
}

export function readSystemEnvironmentSensitiveValues(
  registry: SystemEnvironmentRegistry,
): readonly string[] {
  return registrySensitiveValues.get(registry) ?? [];
}

export function createSystemEnvironmentRegistry(options: {
  system: DefinedSystem;
  source?: ExtensionEnvironmentSource;
  nodeEnv?: 'development' | 'test' | 'production';
}): SystemEnvironmentRegistry {
  const source = options.source ?? {};
  const entries: SystemEnvironmentRegistration[] = [];
  for (const extension of options.system.extensions) {
    const declarations = extension.manifest.environment?.variables ?? [];
    const surface = environmentSurface(extension);
    if (!surface && declarations.length === 0) continue;
    if (!surface) {
      throw new Error(
        `Extension ${extension.manifest.id} declares environment variables without a surface`,
      );
    }
    if (!extension.manifest.environment) {
      throw new Error(
        `Extension ${extension.manifest.id} registered an undeclared environment surface`,
      );
    }
    const declaredByName = new Map(
      declarations.map((declaration) => [declaration.name, declaration]),
    );
    const implementedNames = new Set<string>();
    for (const name of surface.variables) {
      if (!declaredByName.has(name)) {
        throw new Error(
          `Extension ${extension.manifest.id} registered undeclared environment variable ${name}`,
        );
      }
      if (implementedNames.has(name)) {
        throw new Error(
          `Extension ${extension.manifest.id} registered environment variable ${name} more than once`,
        );
      }
      implementedNames.add(name);
    }
    for (const declaration of declarations) {
      if (!implementedNames.has(declaration.name)) {
        throw new Error(
          `Extension ${extension.manifest.id} did not register environment variable ${declaration.name}`,
        );
      }
    }
    const scopedSource = Object.freeze(
      Object.fromEntries(surface.variables.map((name) => [name, source[name]])),
    );
    entries.push({
      extensionId: extension.manifest.id,
      variables: declarations.map((declaration) => ({
        name: declaration.name,
        sensitive: declaration.sensitive ?? false,
      })),
      value: surface.parse(scopedSource, { nodeEnv: options.nodeEnv ?? 'development' }),
      sensitiveValues: declarations.flatMap((declaration) => {
        const rawValue = declaration.sensitive ? source[declaration.name] : undefined;
        return rawValue ? [rawValue] : [];
      }),
    });
  }
  return new SystemEnvironmentRegistry(entries);
}
