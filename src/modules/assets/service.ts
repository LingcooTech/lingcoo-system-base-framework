import { randomUUID } from 'node:crypto';

import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  integrationConnections,
  jobRuns,
  storageAssetReferences,
  storageAssets,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';

type AssetRow = typeof storageAssets.$inferSelect;
type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

export interface StorageAssetGateway {
  createUploadToken(
    connectionId: string,
    input: {
      key: string;
      expiresInSeconds: number;
      maxSizeBytes: number;
      mimeType: string;
    },
    actorId?: string,
  ): Promise<{
    key: string;
    token: string;
    uploadHost: string;
    publicUrl: string;
    expiresInSeconds: number;
  }>;
  statObject(
    connectionId: string,
    key: string,
    actorId?: string,
  ): Promise<{ key: string; hash: string; size: number; mimeType: string; putTime: number }>;
  deleteObject(connectionId: string, key: string, actorId?: string): Promise<{ key: string }>;
  createPrivateUrl(
    connectionId: string,
    input: { key: string; expiresInSeconds?: number },
    actorId?: string,
  ): Promise<{ key: string; url: string; expiresInSeconds: number }>;
}

export function classifyMediaKind(mimeType: string, filename: string): MediaKind {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  if (normalized.startsWith('audio/')) return 'audio';
  if (
    normalized.includes('zip') ||
    normalized.includes('compressed') ||
    /\.(zip|rar|7z|tar|gz)$/i.test(filename)
  ) {
    return 'archive';
  }
  if (
    normalized.startsWith('text/') ||
    normalized.includes('pdf') ||
    normalized.includes('document') ||
    normalized.includes('sheet') ||
    normalized.includes('presentation')
  ) {
    return 'document';
  }
  return 'other';
}

export function safeObjectFilename(filename: string): string {
  const raw = filename.split(/[/\\]/).pop()?.trim() || 'asset';
  const extensionIndex = raw.lastIndexOf('.');
  const extension = extensionIndex > 0 ? raw.slice(extensionIndex).toLowerCase() : '';
  const base = extensionIndex > 0 ? raw.slice(0, extensionIndex) : raw;
  const safeBase =
    base
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'asset';
  const safeExtension = extension.replace(/[^a-z0-9.]/g, '').slice(0, 16);
  return `${safeBase}${safeExtension}`;
}

function safeDirectory(value: string | undefined): string {
  if (!value) return '';
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.some((part) => part === '..' || !/^[a-zA-Z0-9._-]+$/.test(part))) {
    throw httpError(422, '上传目录格式无效', 'ValidationError');
  }
  return parts.join('/').slice(0, 160);
}

function publicAsset(asset: AssetRow, referenceCount = 0) {
  return {
    ...asset,
    publicUrl: asset.visibility === 'public' ? asset.publicUrl : null,
    referenceCount,
  };
}

export class AssetService {
  constructor(
    private readonly db: Database,
    private readonly storage: StorageAssetGateway,
  ) {}

  private async requireAsset(assetId: string): Promise<AssetRow> {
    const [asset] = await this.db.select().from(storageAssets).where(eq(storageAssets.id, assetId));
    if (!asset) throw httpError(404, '媒体资产不存在', 'NotFoundError');
    return asset;
  }

  private async resolveConnection(connectionId?: string) {
    const conditions = [
      eq(integrationConnections.providerCode, 'qiniu'),
      eq(integrationConnections.enabled, true),
    ];
    if (connectionId) conditions.push(eq(integrationConnections.id, connectionId));
    const [connection] = await this.db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(and(...conditions))
      .orderBy(desc(integrationConnections.updatedAt))
      .limit(1);
    if (!connection) throw httpError(422, '没有可用的七牛云存储连接', 'ValidationError');
    return connection.id;
  }

  async list(input: {
    limit: number;
    offset: number;
    status?: string;
    mediaKind?: string;
    search?: string;
  }) {
    const filters = [];
    if (input.status) filters.push(eq(storageAssets.status, input.status));
    else filters.push(sql`${storageAssets.status} <> 'deleted'`);
    if (input.mediaKind) filters.push(eq(storageAssets.mediaKind, input.mediaKind));
    if (input.search) {
      const pattern = `%${input.search}%`;
      filters.push(
        or(
          ilike(storageAssets.displayName, pattern),
          ilike(storageAssets.originalFilename, pattern),
          ilike(storageAssets.objectKey, pattern),
        )!,
      );
    }
    const where = and(...filters);
    const referenceCount = sql<number>`(
      select count(*)::int from storage_asset_references reference
      where reference.asset_id = ${storageAssets.id}
    )`;
    const [items, totalResult] = await Promise.all([
      this.db
        .select({ asset: storageAssets, referenceCount })
        .from(storageAssets)
        .where(where)
        .orderBy(desc(storageAssets.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ count: count() }).from(storageAssets).where(where),
    ]);
    return {
      items: items.map((item) => publicAsset(item.asset, Number(item.referenceCount))),
      total: Number(totalResult[0]?.count ?? 0),
    };
  }

  async summary() {
    const [statusRows, kindRows, totalBytes] = await Promise.all([
      this.db
        .select({ key: storageAssets.status, count: count() })
        .from(storageAssets)
        .groupBy(storageAssets.status),
      this.db
        .select({ key: storageAssets.mediaKind, count: count() })
        .from(storageAssets)
        .where(eq(storageAssets.status, 'active'))
        .groupBy(storageAssets.mediaKind),
      this.db
        .select({ value: sql<number>`coalesce(sum(${storageAssets.byteSize}), 0)::bigint` })
        .from(storageAssets)
        .where(eq(storageAssets.status, 'active')),
    ]);
    return {
      status: Object.fromEntries(statusRows.map((row) => [row.key, Number(row.count)])),
      kind: Object.fromEntries(kindRows.map((row) => [row.key, Number(row.count)])),
      totalBytes: Number(totalBytes[0]?.value ?? 0),
    };
  }

  async createUploadIntent(
    input: {
      connectionId?: string;
      filename: string;
      mimeType: string;
      byteSize: number;
      visibility: 'public' | 'private';
      directory?: string;
    },
    actorId: string,
  ) {
    const connectionId = await this.resolveConnection(input.connectionId);
    const assetId = randomUUID();
    const now = new Date();
    const expiresInSeconds = 15 * 60;
    const datePath = [
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
    ].join('/');
    const objectKey = [
      'assets',
      safeDirectory(input.directory),
      datePath,
      assetId,
      safeObjectFilename(input.filename),
    ]
      .filter(Boolean)
      .join('/');
    const [asset] = await this.db
      .insert(storageAssets)
      .values({
        id: assetId,
        connectionId,
        objectKey,
        originalFilename: input.filename,
        displayName: input.filename,
        mediaKind: classifyMediaKind(input.mimeType, input.filename),
        mimeType: input.mimeType,
        visibility: input.visibility,
        status: 'pending',
        metadata: { expectedByteSize: input.byteSize, expectedMimeType: input.mimeType },
        uploadExpiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
        createdBy: actorId,
      })
      .returning();
    try {
      const token = await this.storage.createUploadToken(
        connectionId,
        {
          key: objectKey,
          expiresInSeconds,
          maxSizeBytes: input.byteSize,
          mimeType: input.mimeType,
        },
        actorId,
      );
      const updated = await this.db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(storageAssets)
          .set({
            objectKey: token.key,
            publicUrl: input.visibility === 'public' ? token.publicUrl : null,
            updatedAt: new Date(),
          })
          .where(eq(storageAssets.id, asset.id))
          .returning();
        await transaction.insert(jobRuns).values({
          queue: 'storage',
          kind: 'storage.asset.expire-upload',
          payload: { assetId: asset.id },
          dedupeKey: `storage-asset-expire:${asset.id}`,
          relatedEntityType: 'storage_asset',
          relatedEntityId: asset.id,
          availableAt: new Date(now.getTime() + (expiresInSeconds + 300) * 1000),
          maxAttempts: 5,
          createdBy: actorId,
        });
        return row;
      });
      return {
        asset: publicAsset(updated),
        upload: {
          token: token.token,
          key: token.key,
          uploadHost: token.uploadHost,
          expiresInSeconds: token.expiresInSeconds,
        },
      };
    } catch (error) {
      await this.db
        .update(storageAssets)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(storageAssets.id, asset.id));
      throw error;
    }
  }

  async confirmUpload(assetId: string, actorId: string) {
    const asset = await this.requireAsset(assetId);
    if (asset.status === 'active') return publicAsset(asset, await this.referenceCount(asset.id));
    if (asset.status !== 'pending') {
      throw httpError(409, '当前资产不能确认上传', 'ConflictError');
    }
    const object = await this.storage.statObject(asset.connectionId, asset.objectKey, actorId);
    const expectedSize = Number(asset.metadata.expectedByteSize ?? 0);
    if (expectedSize && object.size !== expectedSize) {
      await this.db
        .update(storageAssets)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(storageAssets.id, asset.id));
      throw httpError(422, '上传对象大小与上传意图不一致', 'ValidationError');
    }
    const [updated] = await this.db
      .update(storageAssets)
      .set({
        status: 'active',
        mimeType: object.mimeType,
        mediaKind: classifyMediaKind(object.mimeType, asset.originalFilename),
        byteSize: object.size,
        checksum: object.hash,
        confirmedAt: new Date(),
        uploadExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(storageAssets.id, asset.id), eq(storageAssets.status, 'pending')))
      .returning();
    await recordAuditEvent(this.db, {
      action: 'asset.upload_confirmed',
      resourceType: 'storage_asset',
      resourceId: asset.id,
      actorId,
      metadata: { mediaKind: updated.mediaKind, byteSize: updated.byteSize },
    });
    return publicAsset(updated);
  }

  async getAccessUrl(assetId: string, actorId: string) {
    const asset = await this.requireAsset(assetId);
    if (!['active', 'archived'].includes(asset.status)) {
      throw httpError(409, '资产尚不可访问', 'ConflictError');
    }
    if (asset.visibility === 'public' && asset.publicUrl) {
      return { url: asset.publicUrl, expiresInSeconds: null };
    }
    const result = await this.storage.createPrivateUrl(
      asset.connectionId,
      { key: asset.objectKey, expiresInSeconds: 3600 },
      actorId,
    );
    return { url: result.url, expiresInSeconds: result.expiresInSeconds };
  }

  async update(
    assetId: string,
    input: { displayName?: string; metadata?: Record<string, unknown> },
    actorId: string,
  ) {
    const asset = await this.requireAsset(assetId);
    if (!['active', 'archived'].includes(asset.status)) {
      throw httpError(409, '只有已启用或已归档资产可以修改', 'ConflictError');
    }
    const [updated] = await this.db
      .update(storageAssets)
      .set({
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.metadata ? { metadata: { ...asset.metadata, ...input.metadata } } : {}),
        updatedAt: new Date(),
      })
      .where(eq(storageAssets.id, asset.id))
      .returning();
    await recordAuditEvent(this.db, {
      action: 'asset.updated',
      resourceType: 'storage_asset',
      resourceId: asset.id,
      actorId,
    });
    return publicAsset(updated, await this.referenceCount(asset.id));
  }

  async setArchived(assetId: string, archived: boolean, actorId: string) {
    const asset = await this.requireAsset(assetId);
    const expected = archived ? 'active' : 'archived';
    if (asset.status !== expected) {
      throw httpError(
        409,
        archived ? '只有已启用资产可以归档' : '只有归档资产可以恢复',
        'ConflictError',
      );
    }
    const [updated] = await this.db
      .update(storageAssets)
      .set({
        status: archived ? 'archived' : 'active',
        archivedAt: archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(storageAssets.id, asset.id), eq(storageAssets.status, expected)))
      .returning();
    await recordAuditEvent(this.db, {
      action: archived ? 'asset.archived' : 'asset.restored',
      resourceType: 'storage_asset',
      resourceId: asset.id,
      actorId,
    });
    return publicAsset(updated, await this.referenceCount(asset.id));
  }

  async requestDelete(assetId: string, actorId: string) {
    const result = await this.db.transaction(async (transaction) => {
      const [asset] = await transaction
        .select()
        .from(storageAssets)
        .where(eq(storageAssets.id, assetId))
        .for('update');
      if (!asset) throw httpError(404, '媒体资产不存在', 'NotFoundError');
      if (asset.status === 'deleted' || asset.status === 'deleting')
        return { status: asset.status };
      if (!['active', 'archived', 'failed'].includes(asset.status)) {
        throw httpError(409, '当前资产不能删除', 'ConflictError');
      }
      const [references] = await transaction
        .select({ count: count() })
        .from(storageAssetReferences)
        .where(eq(storageAssetReferences.assetId, assetId));
      if (Number(references?.count ?? 0) > 0) {
        throw httpError(409, '资产仍被业务资源引用，不能删除', 'ConflictError');
      }
      await transaction
        .update(storageAssets)
        .set({ status: 'deleting', updatedAt: new Date() })
        .where(eq(storageAssets.id, assetId));
      await transaction
        .insert(jobRuns)
        .values({
          queue: 'storage',
          kind: 'storage.asset.delete',
          payload: { assetId },
          dedupeKey: `storage-asset-delete:${assetId}`,
          relatedEntityType: 'storage_asset',
          relatedEntityId: assetId,
          createdBy: actorId,
        })
        .onConflictDoNothing({ target: jobRuns.dedupeKey });
      return { status: 'deleting' };
    });
    await recordAuditEvent(this.db, {
      action: 'asset.deletion_requested',
      resourceType: 'storage_asset',
      resourceId: assetId,
      actorId,
    });
    return result;
  }

  async executeDelete(assetId: string) {
    const asset = await this.requireAsset(assetId);
    if (asset.status === 'deleted') return { assetId, alreadyDeleted: true };
    if (asset.status !== 'deleting') throw new Error('Asset is not scheduled for deletion');
    await this.storage.deleteObject(asset.connectionId, asset.objectKey);
    await this.db
      .update(storageAssets)
      .set({ status: 'deleted', publicUrl: null, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(storageAssets.id, asset.id));
    return { assetId, deleted: true };
  }

  async expireUpload(assetId: string) {
    const asset = await this.requireAsset(assetId);
    if (asset.status !== 'pending' && !(asset.status === 'failed' && asset.uploadExpiresAt)) {
      return { assetId, skipped: true };
    }
    const [claimed] = await this.db
      .update(storageAssets)
      .set({
        status: 'failed',
        metadata: { ...asset.metadata, uploadExpired: true },
        updatedAt: new Date(),
      })
      .where(and(eq(storageAssets.id, asset.id), eq(storageAssets.status, asset.status)))
      .returning({ id: storageAssets.id });
    if (!claimed) return { assetId, skipped: true };
    await this.storage.deleteObject(asset.connectionId, asset.objectKey);
    await this.db
      .update(storageAssets)
      .set({ uploadExpiresAt: null, publicUrl: null, updatedAt: new Date() })
      .where(eq(storageAssets.id, asset.id));
    return { assetId, expired: true };
  }

  async listReferences(assetId: string) {
    await this.requireAsset(assetId);
    return this.db
      .select()
      .from(storageAssetReferences)
      .where(eq(storageAssetReferences.assetId, assetId))
      .orderBy(desc(storageAssetReferences.createdAt));
  }

  async linkReference(
    assetId: string,
    input: { ownerType: string; ownerId: string; field: string },
    actorId: string,
  ) {
    return this.db.transaction(async (transaction) => {
      const [asset] = await transaction
        .select({ status: storageAssets.status })
        .from(storageAssets)
        .where(eq(storageAssets.id, assetId))
        .for('update');
      if (!asset) throw httpError(404, '媒体资产不存在', 'NotFoundError');
      if (asset.status !== 'active') {
        throw httpError(409, '只有已启用资产可以被引用', 'ConflictError');
      }
      const [reference] = await transaction
        .insert(storageAssetReferences)
        .values({ assetId, ...input, createdBy: actorId })
        .onConflictDoUpdate({
          target: [
            storageAssetReferences.ownerType,
            storageAssetReferences.ownerId,
            storageAssetReferences.field,
          ],
          set: { assetId, createdBy: actorId, createdAt: new Date() },
        })
        .returning();
      return reference;
    });
  }

  async unlinkReference(assetId: string, referenceId: string, actorId: string) {
    const [removed] = await this.db
      .delete(storageAssetReferences)
      .where(
        and(
          eq(storageAssetReferences.id, referenceId),
          eq(storageAssetReferences.assetId, assetId),
        ),
      )
      .returning();
    if (!removed) throw httpError(404, '资产引用不存在', 'NotFoundError');
    await recordAuditEvent(this.db, {
      action: 'asset.reference_removed',
      resourceType: 'storage_asset',
      resourceId: assetId,
      actorId,
      metadata: { ownerType: removed.ownerType, ownerId: removed.ownerId, field: removed.field },
    });
  }

  private async referenceCount(assetId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(storageAssetReferences)
      .where(eq(storageAssetReferences.assetId, assetId));
    return Number(result?.count ?? 0);
  }
}
