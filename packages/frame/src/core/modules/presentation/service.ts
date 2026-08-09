import { and, desc, eq, inArray } from 'drizzle-orm';

import type { Database } from '@lingcootech/frame-database';
import {
  accounts,
  presentationProfiles,
  presentationProfileVersions,
  storageAssetReferences,
  storageAssets,
} from '@lingcootech/frame-database/schema';
import { httpError } from '../../../host/http-error.js';
import { recordAuditEvent } from '../audit/recorder.js';
import type { PresentationInput } from './schemas.js';

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
  displayName: 'Lingcoo Frame',
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
  publicUrl: null,
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
  constructor(private readonly db: Database) {}

  private async assetsFor(profile: typeof defaultPresentation | Profile) {
    const ids = [
      ...new Set(assetFields.map((field) => profile[field]).filter(Boolean)),
    ] as string[];
    if (!ids.length) return {};
    const rows = await this.db
      .select({
        id: storageAssets.id,
        displayName: storageAssets.displayName,
        publicUrl: storageAssets.publicUrl,
        mimeType: storageAssets.mimeType,
      })
      .from(storageAssets)
      .where(inArray(storageAssets.id, ids));
    return Object.fromEntries(rows.map((row) => [row.id, row]));
  }

  async get() {
    const [row] = await this.db
      .select()
      .from(presentationProfiles)
      .where(eq(presentationProfiles.id, profileId));
    const profile = row ?? defaultPresentation;
    return { ...profile, assets: await this.assetsFor(profile) };
  }

  async getPublic() {
    const profile = await this.get();
    const safeProfile = { ...profile } as Record<string, unknown>;
    delete safeProfile.updatedBy;
    delete safeProfile.createdAt;
    return safeProfile;
  }

  async update(input: PresentationInput, actorId: string) {
    const { changeReason, ...values } = input;
    const ids = [...new Set(assetFields.map((field) => values[field]).filter(Boolean))] as string[];
    if (ids.length) {
      const valid = await this.db
        .select({ id: storageAssets.id })
        .from(storageAssets)
        .where(
          and(
            inArray(storageAssets.id, ids),
            eq(storageAssets.status, 'active'),
            eq(storageAssets.visibility, 'public'),
            eq(storageAssets.mediaKind, 'image'),
          ),
        );
      if (valid.length !== ids.length) {
        throw httpError(422, '品牌图片必须是已启用的公开图片资产', 'ValidationError');
      }
    }

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
      await transaction.insert(presentationProfileVersions).values({
        profileId,
        version,
        snapshot: values,
        changeReason,
        changedBy: actorId,
      });
      await transaction
        .delete(storageAssetReferences)
        .where(
          and(
            eq(storageAssetReferences.ownerType, 'presentation_profile'),
            eq(storageAssetReferences.ownerId, profileId),
          ),
        );
      const references = assetFields.flatMap((field) =>
        values[field]
          ? [
              {
                assetId: values[field],
                ownerType: 'presentation_profile',
                ownerId: profileId,
                field,
                createdBy: actorId,
              },
            ]
          : [],
      );
      if (references.length) await transaction.insert(storageAssetReferences).values(references);
      return row;
    });
    await recordAuditEvent(this.db, {
      action: 'presentation.updated',
      resourceType: 'presentation_profile',
      resourceId: profileId,
      actorId,
      metadata: { version: saved.version, reason: changeReason || undefined },
    });
    return { ...saved, assets: await this.assetsFor(saved) };
  }

  async history() {
    return this.db
      .select({
        id: presentationProfileVersions.id,
        version: presentationProfileVersions.version,
        changeReason: presentationProfileVersions.changeReason,
        createdAt: presentationProfileVersions.createdAt,
        actor: { id: accounts.id, email: accounts.email, displayName: accounts.displayName },
      })
      .from(presentationProfileVersions)
      .leftJoin(accounts, eq(presentationProfileVersions.changedBy, accounts.id))
      .where(eq(presentationProfileVersions.profileId, profileId))
      .orderBy(desc(presentationProfileVersions.version));
  }
}
