import type { DefinedSystem } from '@lingcootech/frame-extension-sdk';
import type {
  MigrationExtensionSurface,
  MigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';

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
