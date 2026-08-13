import { and, eq, inArray } from 'drizzle-orm';

import type { AssetsPorts } from '@lingcootech/frame-assets';
import type { Database } from '@lingcootech/frame-database';
import { storageAssetReferences, storageAssets } from '@lingcootech/frame-database/schema';
import { IntegrationService } from '@lingcootech/frame-integrations';
import { QiniuService } from '@lingcootech/frame-storage-qiniu';

import type { AppEnv } from '../../host/env.js';
import { createLegacyAuditPort } from '../audit/ports.js';
import { createIntegrationProviderRegistry } from '../../core/modules/integrations/registry.js';
import { createLegacyIntegrationsPorts } from '../integrations/ports.js';
import { createLegacyJobsPortsForDatabase } from '../jobs/ports.js';

export function createLegacyAssetsPorts(database: Database, env: AppEnv): AssetsPorts {
  const integrationPorts = createLegacyIntegrationsPorts(database);
  const integrations = new IntegrationService(
    database,
    createIntegrationProviderRegistry(env.NODE_ENV),
    env.SETTINGS_ENCRYPTION_KEY,
    integrationPorts,
  );
  const storage = new QiniuService(integrations);
  const jobs = createLegacyJobsPortsForDatabase(database).commands;
  const audit = createLegacyAuditPort(database);
  return {
    audit,
    jobs: {
      async enqueue(transaction, input) {
        await jobs.enqueue(input, transaction);
      },
    },
    storage: {
      async listConnections() {
        return integrationPorts.connections.listEnabled('qiniu');
      },
      async resolveConnection(requestedId) {
        return integrationPorts.connections.resolveEnabled('qiniu', requestedId);
      },
      createUploadToken: (...args) => storage.createUploadToken(...args),
      statObject: (...args) => storage.statObject(...args),
      deleteObject: (...args) => storage.deleteObject(...args),
      createPrivateUrl: (...args) => storage.createPrivateUrl(...args),
    },
    references: {
      async validatePublicImages(assetIds) {
        const uniqueIds = [...new Set(assetIds)];
        if (!uniqueIds.length) return true;
        const rows = await database
          .select({ id: storageAssets.id })
          .from(storageAssets)
          .where(
            and(
              inArray(storageAssets.id, uniqueIds),
              eq(storageAssets.status, 'active'),
              eq(storageAssets.visibility, 'public'),
              eq(storageAssets.mediaKind, 'image'),
            ),
          );
        return rows.length === uniqueIds.length;
      },
      async loadPublicAssets(assetIds) {
        const uniqueIds = [...new Set(assetIds)];
        if (!uniqueIds.length) return [];
        return database
          .select({
            id: storageAssets.id,
            displayName: storageAssets.displayName,
            publicUrl: storageAssets.publicUrl,
            mimeType: storageAssets.mimeType,
          })
          .from(storageAssets)
          .where(inArray(storageAssets.id, uniqueIds));
      },
      async resolvePublicImage(assetId) {
        const [row] = await database
          .select({ publicUrl: storageAssets.publicUrl })
          .from(storageAssets)
          .where(
            and(
              eq(storageAssets.id, assetId),
              eq(storageAssets.status, 'active'),
              eq(storageAssets.visibility, 'public'),
              eq(storageAssets.mediaKind, 'image'),
            ),
          );
        return row ?? null;
      },
      async replaceReferences(transaction, input) {
        await transaction
          .delete(storageAssetReferences)
          .where(
            and(
              eq(storageAssetReferences.ownerType, input.ownerType),
              eq(storageAssetReferences.ownerId, input.ownerId),
            ),
          );
        const references = Object.entries(input.fields).flatMap(([field, assetId]) =>
          assetId
            ? [
                {
                  assetId,
                  ownerType: input.ownerType,
                  ownerId: input.ownerId,
                  field,
                  createdBy: input.actorId,
                },
              ]
            : [],
        );
        if (references.length) await transaction.insert(storageAssetReferences).values(references);
      },
    },
  };
}
