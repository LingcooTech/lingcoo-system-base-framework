import {
  FRAME_VERSION,
  type DefinedSystem,
  type ExtensionDefinition,
} from '@lingcoo/frame-extension-sdk';
import type { MigrationExtensionSurface } from '@lingcoo/frame-extension-sdk/migrations';
import type {
  ServerExtensionSurface,
  ServerSettingDefinition,
} from '@lingcoo/frame-extension-sdk/server';
import type { WorkerExtensionSurface } from '@lingcoo/frame-extension-sdk/worker';
import type { Database, MigrationSource } from '@lingcoo/frame-database';
import type { FastifyInstance } from 'fastify';

import { JobHandlerRegistry, OutboxSubscriberRegistry } from '../core/modules/jobs/registry.js';
import { SettingsRegistry } from '../core/modules/settings/registry.js';
import type { AppEnv } from '../host/env.js';

function serverSurface(extension: ExtensionDefinition): ServerExtensionSurface | undefined {
  return extension.server as ServerExtensionSurface | undefined;
}

function workerSurface(
  extension: ExtensionDefinition,
): WorkerExtensionSurface<AppEnv, Database> | undefined {
  return extension.worker as WorkerExtensionSurface<AppEnv, Database> | undefined;
}

export function assertFrameSystemCompatibility(system: DefinedSystem): void {
  if (system.frameVersion !== FRAME_VERSION) {
    throw new Error(
      `Defined System targets Frame ${system.frameVersion}, but this runtime is ${FRAME_VERSION}`,
    );
  }
  const core = system.extensions.find((extension) => extension.manifest.id === 'frame');
  if (!core || core.manifest.version !== FRAME_VERSION) {
    throw new Error(`Defined System must include frameCoreExtension@${FRAME_VERSION}`);
  }
}

export function createSystemSettingsRegistry(system: DefinedSystem): SettingsRegistry {
  const registry = new SettingsRegistry();
  for (const extension of system.extensions) {
    const declared = new Set(extension.manifest.settings ?? []);
    const definitions = serverSurface(extension)?.settings ?? [];
    for (const definition of definitions) {
      if (!declared.has(definition.key)) {
        throw new Error(
          `Extension ${extension.manifest.id} registered undeclared setting ${definition.key}`,
        );
      }
      registry.register(definition as ServerSettingDefinition);
    }
    for (const key of declared) {
      if (!definitions.some((definition) => definition.key === key)) {
        throw new Error(`Extension ${extension.manifest.id} did not register setting ${key}`);
      }
    }
  }
  return registry;
}

export async function registerSystemServerExtensions(
  app: FastifyInstance,
  system: DefinedSystem,
): Promise<void> {
  for (const extension of system.extensions) {
    const routes = extension.manifest.server?.routes ?? [];
    for (const route of routes) {
      if (app.hasRoute({ method: route.method, url: route.path })) {
        throw new Error(
          `Extension route conflicts with an installed route: ${route.method} ${route.path}`,
        );
      }
    }
    const surface = serverSurface(extension);
    if (!surface && (routes.length > 0 || (extension.manifest.settings?.length ?? 0) > 0)) {
      throw new Error(
        `Extension ${extension.manifest.id} declares Server contributions without a surface`,
      );
    }
    if (surface) await surface.register({ app });
    for (const route of routes) {
      if (!app.hasRoute({ method: route.method, url: route.path })) {
        throw new Error(
          `Extension ${extension.manifest.id} did not register declared route ${route.method} ${route.path}`,
        );
      }
    }
  }
}

export function registerSystemWorkerExtensions(options: {
  system: DefinedSystem;
  env: AppEnv;
  database: Database;
  jobHandlers: JobHandlerRegistry;
  subscribers: OutboxSubscriberRegistry;
}): void {
  for (const extension of options.system.extensions) {
    const declaredJobs = new Set(extension.manifest.worker?.jobs ?? []);
    const declaredSubscriptions = new Set(extension.manifest.worker?.subscriptions ?? []);
    const registeredJobs = new Set<string>();
    const registeredSubscriptions = new Set<string>();
    const surface = workerSurface(extension);
    if (!surface && (declaredJobs.size > 0 || declaredSubscriptions.size > 0)) {
      throw new Error(
        `Extension ${extension.manifest.id} declares Worker contributions without a surface`,
      );
    }
    surface?.register({
      env: options.env,
      database: options.database,
      registerJob(kind, handler) {
        if (!declaredJobs.has(kind)) {
          throw new Error(`Extension ${extension.manifest.id} registered undeclared job ${kind}`);
        }
        options.jobHandlers.register(kind, handler);
        registeredJobs.add(kind);
      },
      subscribe(topic, subscriber) {
        if (!declaredSubscriptions.has(topic)) {
          throw new Error(
            `Extension ${extension.manifest.id} registered undeclared event ${topic}`,
          );
        }
        options.subscribers.subscribe(topic, subscriber);
        registeredSubscriptions.add(topic);
      },
    });
    for (const job of declaredJobs) {
      if (!registeredJobs.has(job)) {
        throw new Error(`Extension ${extension.manifest.id} did not register job ${job}`);
      }
    }
    for (const topic of declaredSubscriptions) {
      if (!registeredSubscriptions.has(topic)) {
        throw new Error(`Extension ${extension.manifest.id} did not register event ${topic}`);
      }
    }
  }
}

export function collectSystemMigrationSources(system: DefinedSystem): MigrationSource[] {
  return system.extensions.flatMap((extension) => {
    const declaration = extension.manifest.migrations;
    const surface = extension.migrations as MigrationExtensionSurface | undefined;
    if (!declaration && !surface) return [];
    if (!declaration || !surface) {
      throw new Error(`Extension ${extension.manifest.id} has an incomplete migration surface`);
    }
    if (surface.source.id !== declaration.sourceId) {
      throw new Error(
        `Extension ${extension.manifest.id} migration source ${surface.source.id} does not match ${declaration.sourceId}`,
      );
    }
    const runtimeDeclarations = surface.source.migrations.map((migration) => ({
      id: migration.id,
      aliases: [...(migration.legacyAliases ?? [])].sort(),
    }));
    const manifestDeclarations = declaration.migrations.map((migration) => ({
      id: migration.id,
      aliases: [...(migration.legacyAliases ?? [])].sort(),
    }));
    if (JSON.stringify(runtimeDeclarations) !== JSON.stringify(manifestDeclarations)) {
      throw new Error(
        `Extension ${extension.manifest.id} migration manifest does not match its source`,
      );
    }
    return [surface.source];
  });
}
