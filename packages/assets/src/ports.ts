import type { Database } from '@lingcootech/frame-database';
import type { AuditCommandPort } from '@lingcootech/frame-audit';

export type AssetsTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface AssetReferencePort {
  validatePublicImages(assetIds: readonly string[]): Promise<boolean>;
  loadPublicAssets(assetIds: readonly string[]): Promise<
    readonly {
      id: string;
      displayName: string;
      publicUrl: string | null;
      mimeType?: string | null;
    }[]
  >;
  resolvePublicImage(assetId: string): Promise<{ publicUrl: string | null } | null>;
  replaceReferences(
    transaction: AssetsTransaction,
    input: {
      ownerType: string;
      ownerId: string;
      fields: Readonly<Record<string, string | null>>;
      actorId: string;
    },
  ): Promise<void>;
}

export type AssetsAuditPort = AuditCommandPort;

export interface AssetStorageConnection {
  id: string;
  providerCode: string;
  name?: string;
}

export interface AssetStoragePort {
  listConnections(): Promise<readonly AssetStorageConnection[]>;
  resolveConnection(requestedId?: string): Promise<AssetStorageConnection | null>;
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

export interface AssetsJobsPort {
  enqueue(
    transaction: AssetsTransaction,
    input: {
      kind: string;
      payload: Record<string, unknown>;
      queue?: string;
      maxAttempts?: number;
      availableAt?: Date;
      dedupeKey?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      createdBy?: string;
    },
  ): Promise<void>;
}

export interface AssetsPorts {
  audit: AssetsAuditPort;
  jobs: AssetsJobsPort;
  storage: AssetStoragePort;
  references: AssetReferencePort;
}

function unavailableStorage(): never {
  throw Object.assign(new Error('Asset storage is not configured'), {
    name: 'ConfigurationError',
    statusCode: 503,
  });
}

export function createNoopAssetsPorts(): AssetsPorts {
  return {
    audit: { async record() {} },
    jobs: {
      async enqueue() {
        throw Object.assign(new Error('Asset jobs are not configured'), {
          name: 'ConfigurationError',
          statusCode: 503,
        });
      },
    },
    storage: {
      async listConnections() {
        return [];
      },
      async resolveConnection() {
        return null;
      },
      async createUploadToken() {
        return unavailableStorage();
      },
      async statObject() {
        return unavailableStorage();
      },
      async deleteObject() {
        return unavailableStorage();
      },
      async createPrivateUrl() {
        return unavailableStorage();
      },
    },
    references: {
      async validatePublicImages() {
        return false;
      },
      async loadPublicAssets() {
        return [];
      },
      async resolvePublicImage() {
        return null;
      },
      async replaceReferences() {},
    },
  };
}
