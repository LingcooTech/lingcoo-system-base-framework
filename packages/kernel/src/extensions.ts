import {
  FRAME_VERSION,
  type DefinedSystem,
  type ExtensionDefinition,
  type ExtensionRouteMethod,
} from '@lingcootech/frame-extension-sdk';
import type { ServerExtensionSurface } from '@lingcootech/frame-extension-sdk/server';

export interface ServerExtensionHost<TApp> {
  app: TApp;
  hasRoute(method: ExtensionRouteMethod, path: string): boolean;
}

export function assertSystemCompatibility(system: DefinedSystem): void {
  if (system.frameVersion !== FRAME_VERSION) {
    throw new Error(
      `Defined System targets Frame ${system.frameVersion}, but this runtime is ${FRAME_VERSION}`,
    );
  }
}

function serverSurface<TApp>(
  extension: ExtensionDefinition,
): ServerExtensionSurface<TApp> | undefined {
  return extension.server as ServerExtensionSurface<TApp> | undefined;
}

export async function registerSystemServerExtensions<TApp>(
  host: ServerExtensionHost<TApp>,
  system: DefinedSystem,
): Promise<void> {
  for (const extension of system.extensions) {
    const routes = extension.manifest.server?.routes ?? [];
    for (const route of routes) {
      if (host.hasRoute(route.method, route.path)) {
        throw new Error(
          `Extension route conflicts with an installed route: ${route.method} ${route.path}`,
        );
      }
    }
    const surface = serverSurface<TApp>(extension);
    if (
      !surface &&
      (routes.length > 0 ||
        (extension.manifest.settings?.length ?? 0) > 0 ||
        (extension.manifest.capabilities?.server?.provides?.length ?? 0) > 0)
    ) {
      throw new Error(
        `Extension ${extension.manifest.id} declares Server contributions without a surface`,
      );
    }
    if (surface) await surface.register({ app: host.app });
    for (const route of routes) {
      if (!host.hasRoute(route.method, route.path)) {
        throw new Error(
          `Extension ${extension.manifest.id} did not register declared route ${route.method} ${route.path}`,
        );
      }
    }
  }
}
