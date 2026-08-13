import type { CmsAssetPort } from '@lingcootech/frame-cms/server';
import type { AssetReferencePort } from '@lingcootech/frame-assets';

export class DatabaseCmsAssetPort implements CmsAssetPort {
  constructor(private readonly assets: AssetReferencePort) {}

  validatePublicImages(assetIds: readonly string[]) {
    return this.assets.validatePublicImages(assetIds);
  }

  async loadPublicAssets(assetIds: readonly string[]) {
    return this.assets.loadPublicAssets(assetIds);
  }

  async replaceReferences(
    transaction: Parameters<CmsAssetPort['replaceReferences']>[0],
    input: Parameters<CmsAssetPort['replaceReferences']>[1],
  ) {
    await this.assets.replaceReferences(transaction, input);
  }
}
