import type { DefinedSystem, ExtensionDefinition } from '@lingcootech/frame-extension-sdk';
import type { MigrationSource } from '@lingcootech/frame-extension-sdk/migrations';
import type {
  ServerExtensionSurface,
  ServerSettingDefinition,
} from '@lingcootech/frame-extension-sdk/server';
import type { WorkerExtensionSurface } from '@lingcootech/frame-extension-sdk/worker';
import type { Database } from '@lingcootech/frame-database';
import {
  assertSystemCompatibility,
  collectSystemMigrationSources as collectKernelMigrationSources,
  createSystemServerCapabilityRegistry as createKernelCapabilityRegistry,
  registerSystemServerExtensions as registerKernelServerExtensions,
  type ServerCapabilityRegistry,
} from '@lingcootech/frame-kernel';
import type { FastifyInstance } from 'fastify';
import type { JobHandlerRegistry, OutboxSubscriberRegistry } from '@lingcootech/frame-jobs/worker';

import { SettingsRegistry } from '../core/modules/settings/registry.js';
import type { AppEnv } from '../host/env.js';
import type { SystemEnvironmentRegistry } from './environment.js';

function serverSurface(extension: ExtensionDefinition): ServerExtensionSurface | undefined {
  return extension.server as ServerExtensionSurface | undefined;
}

function workerSurface(
  extension: ExtensionDefinition,
): WorkerExtensionSurface<AppEnv, Database> | undefined {
  return extension.worker as WorkerExtensionSurface<AppEnv, Database> | undefined;
}

export function assertFrameSystemCompatibility(system: DefinedSystem): void {
  assertSystemCompatibility(system);
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

export function createSystemServerCapabilityRegistry(
  system: DefinedSystem,
  overrides: ReadonlyMap<string, unknown> = new Map(),
): ServerCapabilityRegistry {
  return createKernelCapabilityRegistry(system, overrides);
}

export async function registerSystemServerExtensions(
  app: FastifyInstance,
  system: DefinedSystem,
): Promise<void> {
  await registerKernelServerExtensions(
    {
      app,
      hasRoute(method, path) {
        return app.hasRoute({ method, url: path });
      },
    },
    system,
  );
}

export function registerSystemWorkerExtensions(options: {
  system: DefinedSystem;
  env: AppEnv;
  environment: SystemEnvironmentRegistry;
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
      environment: options.environment,
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
  return collectKernelMigrationSources(system);
}
