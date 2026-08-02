import { and, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  accounts,
  cmsContentEntries,
  cmsContentVersions,
  outboxEvents,
  resourceTerms,
  storageAssetReferences,
  storageAssets,
  taxonomies,
  taxonomyTerms,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import type { CmsContentInput } from './schemas.js';

const resourceType = 'cms.content';
const assetFields = ['coverAssetId', 'socialImageAssetId'] as const;

export class CmsService {
  constructor(private readonly db: Database) {}

  private async requireEntry(contentId: string) {
    const [row] = await this.db
      .select()
      .from(cmsContentEntries)
      .where(eq(cmsContentEntries.id, contentId));
    if (!row) throw httpError(404, '内容不存在', 'NotFoundError');
    return row;
  }

  private async validateInput(input: CmsContentInput, currentId?: string) {
    const [duplicate] = await this.db
      .select({ id: cmsContentEntries.id })
      .from(cmsContentEntries)
      .where(
        and(
          eq(cmsContentEntries.type, input.type),
          eq(cmsContentEntries.slug, input.slug),
          ...(currentId ? [ne(cmsContentEntries.id, currentId)] : []),
        ),
      )
      .limit(1);
    if (duplicate) throw httpError(409, '相同内容类型下的 Slug 已存在', 'ConflictError');

    const assetIds = [
      ...new Set(assetFields.map((field) => input[field]).filter(Boolean)),
    ] as string[];
    if (assetIds.length) {
      const rows = await this.db
        .select({ id: storageAssets.id })
        .from(storageAssets)
        .where(
          and(
            inArray(storageAssets.id, assetIds),
            eq(storageAssets.status, 'active'),
            eq(storageAssets.visibility, 'public'),
            eq(storageAssets.mediaKind, 'image'),
          ),
        );
      if (rows.length !== assetIds.length)
        throw httpError(422, '内容图片必须是已启用的公开图片资产', 'ValidationError');
    }

    const termIds = [...new Set(input.termIds)];
    if (termIds.length) {
      const rows = await this.db
        .select({ id: taxonomyTerms.id })
        .from(taxonomyTerms)
        .innerJoin(taxonomies, eq(taxonomyTerms.taxonomyId, taxonomies.id))
        .where(
          and(
            inArray(taxonomyTerms.id, termIds),
            eq(taxonomyTerms.status, 'active'),
            eq(taxonomies.status, 'active'),
          ),
        );
      if (rows.length !== termIds.length)
        throw httpError(422, '分类或标签不存在或未启用', 'ValidationError');
    }
  }

  private snapshot(input: CmsContentInput) {
    const snapshot = { ...input } as Record<string, unknown>;
    delete snapshot.changeReason;
    return snapshot;
  }

  private async enrich(row: typeof cmsContentEntries.$inferSelect) {
    const [author, terms, assets] = await Promise.all([
      row.authorId
        ? this.db
            .select({ id: accounts.id, displayName: accounts.displayName })
            .from(accounts)
            .where(eq(accounts.id, row.authorId))
            .then((items) => items[0] ?? null)
        : null,
      this.db
        .select({
          id: taxonomyTerms.id,
          code: taxonomyTerms.code,
          name: taxonomyTerms.name,
          color: taxonomyTerms.color,
          taxonomyCode: taxonomies.code,
          taxonomyName: taxonomies.name,
          taxonomyKind: taxonomies.kind,
        })
        .from(resourceTerms)
        .innerJoin(taxonomyTerms, eq(resourceTerms.termId, taxonomyTerms.id))
        .innerJoin(taxonomies, eq(taxonomyTerms.taxonomyId, taxonomies.id))
        .where(
          and(eq(resourceTerms.resourceType, resourceType), eq(resourceTerms.resourceId, row.id)),
        ),
      [row.coverAssetId, row.socialImageAssetId].filter(Boolean).length
        ? this.db
            .select({
              id: storageAssets.id,
              displayName: storageAssets.displayName,
              publicUrl: storageAssets.publicUrl,
            })
            .from(storageAssets)
            .where(
              inArray(
                storageAssets.id,
                [row.coverAssetId, row.socialImageAssetId].filter(Boolean) as string[],
              ),
            )
        : [],
    ]);
    return {
      ...row,
      author,
      terms,
      assets: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    };
  }

  async list(input: {
    type?: string;
    status?: string;
    search?: string;
    limit: number;
    offset: number;
  }) {
    const filters = [];
    if (input.type) filters.push(eq(cmsContentEntries.type, input.type));
    if (input.status) filters.push(eq(cmsContentEntries.status, input.status));
    if (input.search) {
      const pattern = `%${input.search}%`;
      filters.push(
        or(ilike(cmsContentEntries.title, pattern), ilike(cmsContentEntries.slug, pattern))!,
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(cmsContentEntries)
        .where(where)
        .orderBy(desc(cmsContentEntries.updatedAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ value: count() }).from(cmsContentEntries).where(where),
    ]);
    return {
      items: await Promise.all(rows.map((row) => this.enrich(row))),
      total: Number(total[0]?.value ?? 0),
    };
  }

  async get(contentId: string) {
    return this.enrich(await this.requireEntry(contentId));
  }

  async create(input: CmsContentInput, actorId: string) {
    await this.validateInput(input);
    const { termIds, changeReason, ...values } = input;
    const row = await this.db.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(cmsContentEntries)
        .values({ ...values, authorId: actorId, createdBy: actorId, updatedBy: actorId })
        .returning();
      await transaction.insert(cmsContentVersions).values({
        contentId: created.id,
        version: 1,
        snapshot: this.snapshot(input),
        changeReason,
        createdBy: actorId,
      });
      await this.syncRelations(transaction, created.id, values, termIds, actorId);
      return created;
    });
    await recordAuditEvent(this.db, {
      action: 'cms.content_created',
      resourceType,
      resourceId: row.id,
      actorId,
      metadata: { type: row.type, slug: row.slug },
    });
    return this.enrich(row);
  }

  async update(contentId: string, input: CmsContentInput, actorId: string) {
    await this.requireEntry(contentId);
    await this.validateInput(input, contentId);
    const { termIds, changeReason, ...values } = input;
    const row = await this.db.transaction(async (transaction) => {
      const [current] = await transaction
        .select()
        .from(cmsContentEntries)
        .where(eq(cmsContentEntries.id, contentId))
        .for('update');
      const version = current.currentVersion + 1;
      const [updated] = await transaction
        .update(cmsContentEntries)
        .set({ ...values, currentVersion: version, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(cmsContentEntries.id, contentId))
        .returning();
      await transaction.insert(cmsContentVersions).values({
        contentId,
        version,
        snapshot: this.snapshot(input),
        changeReason,
        createdBy: actorId,
      });
      await this.syncRelations(transaction, contentId, values, termIds, actorId);
      return updated;
    });
    await recordAuditEvent(this.db, {
      action: 'cms.content_updated',
      resourceType,
      resourceId: contentId,
      actorId,
      metadata: { version: row.currentVersion },
    });
    return this.enrich(row);
  }

  private async syncRelations(
    transaction: Parameters<Parameters<Database['transaction']>[0]>[0],
    contentId: string,
    values: { coverAssetId: string | null; socialImageAssetId: string | null },
    termIds: string[],
    actorId: string,
  ) {
    await transaction
      .delete(storageAssetReferences)
      .where(
        and(
          eq(storageAssetReferences.ownerType, resourceType),
          eq(storageAssetReferences.ownerId, contentId),
        ),
      );
    const references = assetFields.flatMap((field) =>
      values[field]
        ? [
            {
              assetId: values[field]!,
              ownerType: resourceType,
              ownerId: contentId,
              field,
              createdBy: actorId,
            },
          ]
        : [],
    );
    if (references.length) await transaction.insert(storageAssetReferences).values(references);
    await transaction
      .delete(resourceTerms)
      .where(
        and(eq(resourceTerms.resourceType, resourceType), eq(resourceTerms.resourceId, contentId)),
      );
    if (termIds.length)
      await transaction.insert(resourceTerms).values(
        [...new Set(termIds)].map((termId) => ({
          termId,
          resourceType,
          resourceId: contentId,
          assignedBy: actorId,
        })),
      );
  }

  async setStatus(contentId: string, status: 'draft' | 'published' | 'archived', actorId: string) {
    const current = await this.requireEntry(contentId);
    if (status === 'published' && !current.body.trim())
      throw httpError(422, '正文为空，不能发布', 'ValidationError');
    const [updated] = await this.db.transaction(async (transaction) => {
      const rows = await transaction
        .update(cmsContentEntries)
        .set({
          status,
          publishedAt: status === 'published' ? new Date() : current.publishedAt,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(cmsContentEntries.id, contentId))
        .returning();
      if (status === 'published')
        await transaction
          .insert(outboxEvents)
          .values({
            topic: 'cms.content.published',
            aggregateType: resourceType,
            aggregateId: contentId,
            payload: { contentId, type: current.type, slug: current.slug },
            dedupeKey: `cms-published:${contentId}:${current.currentVersion}`,
          })
          .onConflictDoNothing({ target: outboxEvents.dedupeKey });
      return rows;
    });
    await recordAuditEvent(this.db, {
      action: `cms.content_${status}`,
      resourceType,
      resourceId: contentId,
      actorId,
    });
    return this.enrich(updated);
  }

  async versions(contentId: string) {
    await this.requireEntry(contentId);
    return this.db
      .select({
        id: cmsContentVersions.id,
        version: cmsContentVersions.version,
        changeReason: cmsContentVersions.changeReason,
        createdAt: cmsContentVersions.createdAt,
        actor: { id: accounts.id, displayName: accounts.displayName },
      })
      .from(cmsContentVersions)
      .leftJoin(accounts, eq(cmsContentVersions.createdBy, accounts.id))
      .where(eq(cmsContentVersions.contentId, contentId))
      .orderBy(desc(cmsContentVersions.version));
  }

  async getPublic(type: 'article' | 'page', slug: string) {
    const [row] = await this.db
      .select()
      .from(cmsContentEntries)
      .where(
        and(
          eq(cmsContentEntries.type, type),
          eq(cmsContentEntries.slug, slug),
          eq(cmsContentEntries.status, 'published'),
        ),
      )
      .limit(1);
    if (!row) throw httpError(404, '内容不存在或尚未发布', 'NotFoundError');
    return this.enrich(row);
  }

  async listPublicArticles(limit: number) {
    const rows = await this.db
      .select()
      .from(cmsContentEntries)
      .where(and(eq(cmsContentEntries.type, 'article'), eq(cmsContentEntries.status, 'published')))
      .orderBy(desc(cmsContentEntries.pinned), desc(cmsContentEntries.publishedAt))
      .limit(limit);
    return Promise.all(rows.map((row) => this.enrich(row)));
  }
}
