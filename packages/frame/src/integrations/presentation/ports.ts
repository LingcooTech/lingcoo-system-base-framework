import type { PresentationPorts } from '@lingcootech/frame-presentation';
import type { AssetReferencePort } from '@lingcootech/frame-assets';
import type { Database } from '@lingcootech/frame-database';
import { PostgresIdentityAccountDirectory } from '@lingcootech/frame-identity/postgres';
import { createLegacyAuditPort } from '../audit/ports.js';

export function createLegacyPresentationPorts(
  db: Database,
  assets: AssetReferencePort,
): PresentationPorts {
  return {
    accounts: new PostgresIdentityAccountDirectory(db),
    audit: createLegacyAuditPort(db),
    assets: {
      load: assets.loadPublicAssets,
      validatePublicImages: assets.validatePublicImages,
      replaceReferences: assets.replaceReferences,
    },
  };
}
