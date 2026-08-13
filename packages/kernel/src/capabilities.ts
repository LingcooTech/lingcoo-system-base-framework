import type { DefinedSystem, ExtensionDefinition } from '@lingcootech/frame-extension-sdk';
import type {
  ServerCapabilityImplementation,
  ServerExtensionSurface,
} from '@lingcootech/frame-extension-sdk/server';

export interface ServerCapabilityDescriptor {
  id: string;
  version: string;
  extensionId: string;
}

export interface ServerCapabilityRegistration<T = unknown> extends ServerCapabilityDescriptor {
  value: T;
}

interface ServerCapabilityEntry extends ServerCapabilityDescriptor {
  value: unknown;
}

export class ServerCapabilityRegistry {
  readonly #entries: ReadonlyMap<string, ServerCapabilityEntry>;

  constructor(registrations: readonly ServerCapabilityRegistration[]) {
    const entries = new Map<string, ServerCapabilityEntry>();
    for (const registration of registrations) {
      if (entries.has(registration.id)) {
        throw new Error(`Duplicate Server capability implementation ${registration.id}`);
      }
      entries.set(registration.id, { ...registration });
    }
    this.#entries = entries;
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  get<T = unknown>(id: string): T | undefined {
    return this.#entries.get(id)?.value as T | undefined;
  }

  require<T = unknown>(id: string): T {
    const entry = this.#entries.get(id);
    if (!entry) throw new Error(`Required Server capability ${id} is not installed`);
    return entry.value as T;
  }

  describe(): readonly ServerCapabilityDescriptor[] {
    return [...this.#entries.values()].map(({ id, version, extensionId }) => ({
      id,
      version,
      extensionId,
    }));
  }
}

function serverSurface(extension: ExtensionDefinition): ServerExtensionSurface | undefined {
  return extension.server as ServerExtensionSurface | undefined;
}

export function createSystemServerCapabilityRegistry(
  system: DefinedSystem,
  overrides: ReadonlyMap<string, unknown> = new Map(),
): ServerCapabilityRegistry {
  const registrations: ServerCapabilityRegistration[] = [];
  for (const extension of system.extensions) {
    const declared = extension.manifest.capabilities?.server?.provides ?? [];
    const declaredById = new Map(declared.map((provider) => [provider.id, provider]));
    const implementations = serverSurface(extension)?.capabilities ?? [];
    const implementedIds = new Set<string>();
    for (const implementation of implementations as readonly ServerCapabilityImplementation[]) {
      const declaration = declaredById.get(implementation.id);
      if (!declaration) {
        throw new Error(
          `Extension ${extension.manifest.id} registered undeclared Server capability ${implementation.id}`,
        );
      }
      if (implementedIds.has(implementation.id)) {
        throw new Error(
          `Extension ${extension.manifest.id} registered Server capability ${implementation.id} more than once`,
        );
      }
      if (implementation.value === undefined) {
        throw new Error(
          `Extension ${extension.manifest.id} registered Server capability ${implementation.id} without an implementation`,
        );
      }
      implementedIds.add(implementation.id);
      registrations.push({
        ...declaration,
        extensionId: extension.manifest.id,
        value: overrides.has(declaration.id) ? overrides.get(declaration.id) : implementation.value,
      });
    }
    for (const declaration of declared) {
      if (!implementedIds.has(declaration.id)) {
        throw new Error(
          `Extension ${extension.manifest.id} did not register Server capability ${declaration.id}`,
        );
      }
    }
  }
  for (const [id, value] of overrides) {
    if (!registrations.some((registration) => registration.id === id)) {
      throw new Error(`Cannot override undeclared Server capability ${id}`);
    }
    if (value === undefined) {
      throw new Error(`Cannot override Server capability ${id} without an implementation`);
    }
  }
  return new ServerCapabilityRegistry(registrations);
}
