import { sql } from 'drizzle-orm';

import type { DefinedSystem, ExtensionManifest } from '@lingcootech/frame-extension-sdk';

import type { AppModule } from '../types.js';

function hasContributions(values: readonly unknown[] | undefined): boolean {
  return Boolean(values?.length);
}

function extensionSurfaces(manifest: ExtensionManifest): string[] {
  const surfaces: string[] = [];
  if (hasContributions(manifest.server?.routes) || hasContributions(manifest.settings)) {
    surfaces.push('server');
  }
  if (hasContributions(manifest.worker?.jobs) || hasContributions(manifest.worker?.subscriptions)) {
    surfaces.push('worker');
  }
  if (manifest.migrations) surfaces.push('migrations');
  if (manifest.admin && Object.values(manifest.admin).some(hasContributions)) {
    surfaces.push('admin');
  }
  if (manifest.web && Object.values(manifest.web).some(hasContributions)) {
    surfaces.push('web');
  }
  return surfaces;
}

export function describeSystemRuntime(input: {
  system: DefinedSystem;
  application: { name: string; version: string; environment: string };
  appliedMigrationNames?: readonly string[];
  migrationLedgerAvailable?: boolean;
}) {
  const appliedNames = new Set(input.appliedMigrationNames ?? []);
  const migrationSources = input.system.extensions.flatMap((extension) => {
    const declaration = extension.manifest.migrations;
    if (!declaration) return [];
    const declaredNames = declaration.migrations.map(
      (migration) => `${declaration.sourceId}/${migration.id}`,
    );
    const appliedCount = declaredNames.filter((name) => appliedNames.has(name)).length;
    return [
      {
        id: declaration.sourceId,
        extensionId: extension.manifest.id,
        declaredCount: declaredNames.length,
        appliedCount,
        pendingCount: declaredNames.length - appliedCount,
      },
    ];
  });
  const declaredCount = migrationSources.reduce((sum, source) => sum + source.declaredCount, 0);
  const appliedCount = migrationSources.reduce((sum, source) => sum + source.appliedCount, 0);
  const pendingCount = declaredCount - appliedCount;
  const ledgerAvailable = input.migrationLedgerAvailable ?? true;

  return {
    name: input.application.name,
    version: input.application.version,
    environment: input.application.environment,
    surfaces: ['api', 'worker', 'admin-ui', 'public-web'],
    system: {
      id: input.system.id,
      version: input.system.version,
    },
    frame: {
      version: input.system.frameVersion,
      apiVersion: input.system.extensionApiVersion,
    },
    extensions: input.system.extensions.map((extension) => {
      const manifest = extension.manifest;
      return {
        id: manifest.id,
        version: manifest.version,
        surfaces: extensionSurfaces(manifest),
        contributions: {
          permissions: manifest.permissions?.length ?? 0,
          settings: manifest.settings?.length ?? 0,
          serverRoutes: manifest.server?.routes?.length ?? 0,
          jobs: manifest.worker?.jobs?.length ?? 0,
          subscriptions: manifest.worker?.subscriptions?.length ?? 0,
          migrations: manifest.migrations?.migrations.length ?? 0,
          adminRoutes: manifest.admin?.routes?.length ?? 0,
          webRoutes: manifest.web?.routes?.length ?? 0,
        },
      };
    }),
    migrations: {
      status: !ledgerAvailable ? 'unavailable' : pendingCount > 0 ? 'pending' : 'current',
      declaredCount,
      appliedCount,
      pendingCount,
      ledgerCount: input.appliedMigrationNames?.length ?? 0,
      sources: migrationSources,
    },
  } as const;
}

export const systemModule: AppModule = {
  name: 'system',
  register(app) {
    app.get(
      '/api/system/runtime',
      { preHandler: app.requirePermission('system.runtime.read') },
      async () => {
        let appliedMigrationNames: string[] = [];
        let migrationLedgerAvailable = true;
        try {
          const result = await app.db.execute<{ name: string }>(
            sql`select name from framework_migrations order by applied_at asc`,
          );
          appliedMigrationNames = result.rows.map((row) => row.name);
        } catch {
          migrationLedgerAvailable = false;
        }
        return describeSystemRuntime({
          system: app.frameSystem,
          application: {
            name: app.appEnv.APP_NAME,
            version: app.appEnv.APP_VERSION,
            environment: app.appEnv.NODE_ENV,
          },
          appliedMigrationNames,
          migrationLedgerAvailable,
        });
      },
    );
  },
};
