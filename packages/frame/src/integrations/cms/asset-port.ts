import { and, eq, inArray } from 'drizzle-orm';

import type { CmsAssetPort } from '@lingcootech/frame-cms/server';
import type { Database } from '@lingcootech/frame-database';
import { storageAssetReferences, storageAssets } from '@lingcootech/frame-database/schema';

export class DatabaseCmsAssetPort implements CmsAssetPort {
  constructor(private readonly db: Database) {}

  async validatePublicImages(assetIds: readonly string[]): Promise<boolean> {
    const uniqueIds = [...new Set(assetIds)];
    if (uniqueIds.length === 0) return true;
    const rows = await this.db
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
  }

  async loadPublicAssets(assetIds: readonly string[]) {
    const uniqueIds = [...new Set(assetIds)];
    if (uniqueIds.length === 0) return [];
    return this.db
      .select({
        id: storageAssets.id,
        displayName: storageAssets.displayName,
        publicUrl: storageAssets.publicUrl,
      })
      .from(storageAssets)
      .where(inArray(storageAssets.id, uniqueIds));
  }

  async replaceReferences(
    transaction: Parameters<CmsAssetPort['replaceReferences']>[0],
    input: Parameters<CmsAssetPort['replaceReferences']>[1],
  ) {
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
  }
}
