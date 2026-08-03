import { and, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  accounts,
  cmsContentEntries,
  cmsContentVersions,
  cmsRedirects,
  jobRuns,
  outboxEvents,
  resourceTerms,
  storageAssetReferences,
  storageAssets,
  taxonomies,
  taxonomyTerms,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import type { CmsContentInput, CmsRedirectInput } from './schemas.js';

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
          scheduledPublishAt: null,
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

  async schedule(contentId: string, publishAt: string | null, actorId: string) {
    const current = await this.requireEntry(contentId);
    if (current.status === 'archived')
      throw httpError(409, '已归档内容不能计划发布', 'ConflictError');
    if (publishAt && !current.body.trim())
      throw httpError(422, '正文为空，不能计划发布', 'ValidationError');
    const scheduledAt = publishAt ? new Date(publishAt) : null;
    if (scheduledAt && scheduledAt.getTime() <= Date.now() + 30_000)
      throw httpError(422, '计划发布时间必须晚于当前时间', 'ValidationError');

    const updated = await this.db.transaction(async (transaction) => {
      const [row] = await transaction
        .update(cmsContentEntries)
        .set({
          status: current.status === 'published' && scheduledAt ? 'draft' : current.status,
          scheduledPublishAt: scheduledAt,
          updatedBy: actorId,
          updatedAt: new Date(),
        })
        .where(eq(cmsContentEntries.id, contentId))
        .returning();
      if (scheduledAt) {
        await transaction
          .insert(jobRuns)
          .values({
            kind: 'cms.content.publish-scheduled',
            queue: 'default',
            payload: { contentId, publishAt: scheduledAt.toISOString(), actorId },
            availableAt: scheduledAt,
            dedupeKey: `cms-publish:${contentId}:${scheduledAt.toISOString()}`,
            relatedEntityType: resourceType,
            relatedEntityId: contentId,
            createdBy: actorId,
          })
          .onConflictDoNothing({ target: jobRuns.dedupeKey });
      }
      return row;
    });
    await recordAuditEvent(this.db, {
      action: scheduledAt ? 'cms.content_scheduled' : 'cms.content_schedule_cancelled',
      resourceType,
      resourceId: contentId,
      actorId,
      metadata: scheduledAt ? { publishAt: scheduledAt.toISOString() } : undefined,
    });
    return this.enrich(updated);
  }

  async publishScheduled(contentId: string, publishAt: string, actorId: string) {
    const current = await this.requireEntry(contentId);
    if (
      !current.scheduledPublishAt ||
      current.scheduledPublishAt.toISOString() !== publishAt ||
      current.status === 'archived'
    ) {
      return { skipped: true, reason: 'schedule_changed' };
    }
    if (current.scheduledPublishAt.getTime() > Date.now()) {
      throw new Error('计划发布时间尚未到达');
    }
    await this.setStatus(contentId, 'published', actorId);
    return { published: true, contentId };
  }

  async listRedirects() {
    return this.db.select().from(cmsRedirects).orderBy(desc(cmsRedirects.updatedAt));
  }

  private async validateRedirect(input: CmsRedirectInput, currentId?: string) {
    const redirects = await this.db.select().from(cmsRedirects);
    const duplicate = redirects.find(
      (item) => item.sourcePath === input.sourcePath && item.id !== currentId,
    );
    if (duplicate) throw httpError(409, '来源路径已经存在重定向', 'ConflictError');
    const nextBySource = new Map(
      redirects
        .filter((item) => item.enabled && item.id !== currentId)
        .map((item) => [item.sourcePath, item.targetPath]),
    );
    let next: string | undefined = input.targetPath;
    for (let depth = 0; next && depth <= redirects.length; depth += 1) {
      if (next === input.sourcePath)
        throw httpError(422, '重定向配置会形成循环', 'ValidationError');
      next = nextBySource.get(next);
    }
  }

  async createRedirect(input: CmsRedirectInput, actorId: string) {
    await this.validateRedirect(input);
    const [created] = await this.db
      .insert(cmsRedirects)
      .values({ ...input, createdBy: actorId, updatedBy: actorId })
      .returning();
    await recordAuditEvent(this.db, {
      action: 'cms.redirect_created',
      resourceType: 'cms.redirect',
      resourceId: created.id,
      actorId,
      metadata: { sourcePath: created.sourcePath, targetPath: created.targetPath },
    });
    return created;
  }

  async updateRedirect(redirectId: string, input: CmsRedirectInput, actorId: string) {
    await this.validateRedirect(input, redirectId);
    const [updated] = await this.db
      .update(cmsRedirects)
      .set({ ...input, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(cmsRedirects.id, redirectId))
      .returning();
    if (!updated) throw httpError(404, '重定向不存在', 'NotFoundError');
    await recordAuditEvent(this.db, {
      action: 'cms.redirect_updated',
      resourceType: 'cms.redirect',
      resourceId: redirectId,
      actorId,
      metadata: { sourcePath: updated.sourcePath, targetPath: updated.targetPath },
    });
    return updated;
  }

  async deleteRedirect(redirectId: string, actorId: string) {
    const [deleted] = await this.db
      .delete(cmsRedirects)
      .where(eq(cmsRedirects.id, redirectId))
      .returning();
    if (!deleted) throw httpError(404, '重定向不存在', 'NotFoundError');
    await recordAuditEvent(this.db, {
      action: 'cms.redirect_deleted',
      resourceType: 'cms.redirect',
      resourceId: redirectId,
      actorId,
      metadata: { sourcePath: deleted.sourcePath, targetPath: deleted.targetPath },
    });
  }

  async resolveRedirect(path: string) {
    const [redirect] = await this.db
      .select({ targetPath: cmsRedirects.targetPath, statusCode: cmsRedirects.statusCode })
      .from(cmsRedirects)
      .where(and(eq(cmsRedirects.sourcePath, path), eq(cmsRedirects.enabled, true)))
      .limit(1);
    return redirect ?? null;
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

  async listPublicArticles(page: number, pageSize: number) {
    const where = and(
      eq(cmsContentEntries.type, 'article'),
      eq(cmsContentEntries.status, 'published'),
    );
    const [rows, [{ value: total }]] = await Promise.all([
      this.db
        .select()
        .from(cmsContentEntries)
        .where(where)
        .orderBy(desc(cmsContentEntries.pinned), desc(cmsContentEntries.publishedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(cmsContentEntries).where(where),
    ]);
    return {
      items: await Promise.all(rows.map((row) => this.enrich(row))),
      page,
      pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async listPublicRoutes() {
    return this.db
      .select({
        type: cmsContentEntries.type,
        slug: cmsContentEntries.slug,
        updatedAt: cmsContentEntries.updatedAt,
      })
      .from(cmsContentEntries)
      .where(eq(cmsContentEntries.status, 'published'))
      .orderBy(desc(cmsContentEntries.updatedAt));
  }
}
