import { desc, eq } from 'drizzle-orm';
import type { Database } from '@lingcootech/frame-database';
import {
  presentationProfiles,
  presentationProfileVersions,
} from '@lingcootech/frame-database/schema';
import type { PresentationInput } from './schemas.js';
import type { PresentationPorts } from './contracts.js';
import { defaultPresentationProfileSummary } from './profile-reader.js';
const profileId = 'default';
const assetFields = [
  'fullLogoAssetId',
  'squareLogoAssetId',
  'darkLogoAssetId',
  'faviconAssetId',
  'socialImageAssetId',
] as const;
export const defaultPresentation = {
  id: profileId,
  ...defaultPresentationProfileSummary,
  shortName: 'Frame',
  slogan: 'Foundation first. Domain follows.',
  fullLogoAssetId: null,
  squareLogoAssetId: null,
  darkLogoAssetId: null,
  faviconAssetId: null,
  socialImageAssetId: null,
  primaryColor: '#315f47',
  secondaryColor: '#b9efc5',
  accentColor: '#39735a',
  contactEmail: null,
  contactPhone: null,
  contactAddress: null,
  seoTitle: null,
  seoDescription: null,
  headerNavigation: [],
  footerLinks: [],
  footerCopyright: null,
  filingInfo: null,
  version: 0,
  updatedAt: null,
};
type Profile = typeof presentationProfiles.$inferSelect;
export class PresentationService {
  constructor(
    private readonly db: Database,
    private readonly ports: PresentationPorts,
  ) {}
  private async withAssets(profile: typeof defaultPresentation | Profile) {
    const ids = [
      ...new Set(assetFields.map((field) => profile[field]).filter(Boolean)),
    ] as string[];
    if (!ids.length) return { ...profile, assets: {} };
    const rows = await this.ports.assets.load(ids);
    return { ...profile, assets: Object.fromEntries(rows.map((row) => [row.id, row])) };
  }
  async get() {
    const [row] = await this.db
      .select()
      .from(presentationProfiles)
      .where(eq(presentationProfiles.id, profileId));
    return this.withAssets(row ?? defaultPresentation);
  }
  async getPublic() {
    const profile = await this.get();
    const safe = { ...profile } as Record<string, unknown>;
    delete safe.updatedBy;
    delete safe.createdAt;
    return safe;
  }
  async update(input: PresentationInput, actorId: string) {
    const { changeReason, ...values } = input;
    const ids = [...new Set(assetFields.map((field) => values[field]).filter(Boolean))] as string[];
    if (ids.length && !(await this.ports.assets.validatePublicImages(ids)))
      throw Object.assign(new Error('品牌图片必须是已启用的公开图片资产'), {
        name: 'ValidationError',
        statusCode: 422,
      });
    const saved = await this.db.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({ version: presentationProfiles.version })
        .from(presentationProfiles)
        .where(eq(presentationProfiles.id, profileId))
        .for('update');
      const version = (existing?.version ?? 0) + 1;
      const [row] = await transaction
        .insert(presentationProfiles)
        .values({ id: profileId, ...values, version, updatedBy: actorId })
        .onConflictDoUpdate({
          target: presentationProfiles.id,
          set: { ...values, version, updatedBy: actorId, updatedAt: new Date() },
        })
        .returning();
      await transaction
        .insert(presentationProfileVersions)
        .values({ profileId, version, snapshot: values, changeReason, changedBy: actorId });
      await this.ports.assets.replaceReferences(transaction, {
        ownerType: 'presentation_profile',
        ownerId: profileId,
        fields: Object.fromEntries(assetFields.map((field) => [field, values[field]])),
        actorId,
      });
      return row;
    });
    await this.ports.audit.record({
      action: 'presentation.updated',
      resourceType: 'presentation_profile',
      resourceId: profileId,
      actorId,
      metadata: { version: saved.version, reason: changeReason || undefined },
    });
    return this.withAssets(saved);
  }
  async history() {
    const versions = await this.db
      .select({
        id: presentationProfileVersions.id,
        version: presentationProfileVersions.version,
        changeReason: presentationProfileVersions.changeReason,
        createdAt: presentationProfileVersions.createdAt,
        changedBy: presentationProfileVersions.changedBy,
      })
      .from(presentationProfileVersions)
      .where(eq(presentationProfileVersions.profileId, profileId))
      .orderBy(desc(presentationProfileVersions.version));
    const actors = await this.ports.accounts.findByIds(
      versions.flatMap((version) => (version.changedBy ? [version.changedBy] : [])),
    );
    const actorsById = new Map(actors.map((actor) => [actor.id, actor]));
    return versions.map(({ changedBy, ...version }) => ({
      ...version,
      actor: changedBy ? (actorsById.get(changedBy) ?? null) : null,
    }));
  }
}
