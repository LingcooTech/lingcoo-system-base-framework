import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { accounts, integrationConnections, jobRuns, storageAssets } from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import {
  AssetService,
  classifyMediaKind,
  safeObjectFilename,
  type StorageAssetGateway,
} from '../src/modules/assets/service.js';

test('asset filenames and media kinds are normalized without business semantics', () => {
  assert.equal(safeObjectFilename('../../课程 封面 01.PNG'), '01.png');
  assert.equal(classifyMediaKind('image/png', 'file.bin'), 'image');
  assert.equal(classifyMediaKind('application/pdf', 'file.bin'), 'document');
  assert.equal(classifyMediaKind('application/octet-stream', 'bundle.zip'), 'archive');
});

const databaseUrl = process.env.DATABASE_URL;

test(
  'asset lifecycle verifies uploads, protects references and deletes through a job handler',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'assets-test-secret-with-at-least-32-characters',
      }),
    );
    const [account] = await app.db
      .insert(accounts)
      .values({ email: 'asset-owner@example.test', displayName: 'Asset Owner' })
      .onConflictDoUpdate({ target: accounts.email, set: { status: 'active' } })
      .returning({ id: accounts.id });
    const [connection] = await app.db
      .insert(integrationConnections)
      .values({
        providerCode: 'qiniu',
        name: 'Asset test storage',
        enabled: true,
        config: {},
        encryptedCredentials: {},
        credentialKeys: [],
        createdBy: account.id,
      })
      .returning({ id: integrationConnections.id });

    const deletedKeys: string[] = [];
    const gateway: StorageAssetGateway = {
      async createUploadToken(_connectionId, input) {
        return {
          key: `frame/${input.key}`,
          token: 'safe-upload-token',
          uploadHost: 'https://upload.example.test',
          publicUrl: `https://assets.example.test/frame/${input.key}`,
          expiresInSeconds: input.expiresInSeconds,
        };
      },
      async statObject(_connectionId, key) {
        return { key, hash: 'qiniu-hash', size: 512, mimeType: 'image/png', putTime: 1 };
      },
      async deleteObject(_connectionId, key) {
        deletedKeys.push(key);
        return { key };
      },
      async createPrivateUrl(_connectionId, input) {
        return {
          key: input.key,
          url: 'https://private.example.test/signed',
          expiresInSeconds: 3600,
        };
      },
    };
    const service = new AssetService(app.db, gateway);
    const intent = await service.createUploadIntent(
      {
        connectionId: connection.id,
        filename: '产品 图片.png',
        mimeType: 'image/png',
        byteSize: 512,
        visibility: 'public',
      },
      account.id,
    );
    assert.equal(intent.asset.status, 'pending');
    assert.match(intent.upload.key, /^frame\/assets\//);
    const [expiryJob] = await app.db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.relatedEntityId, intent.asset.id));
    assert.equal(expiryJob.kind, 'storage.asset.expire-upload');

    const active = await service.confirmUpload(intent.asset.id, account.id);
    assert.equal(active.status, 'active');
    assert.equal(active.byteSize, 512);
    assert.equal(active.checksum, 'qiniu-hash');
    const reference = await service.linkReference(
      active.id,
      { ownerType: 'test.record', ownerId: 'record-1', field: 'cover' },
      account.id,
    );
    await assert.rejects(() => service.requestDelete(active.id, account.id), /仍被业务资源引用/);
    await service.unlinkReference(active.id, reference.id, account.id);
    await service.setArchived(active.id, true, account.id);
    const deletion = await service.requestDelete(active.id, account.id);
    assert.equal(deletion.status, 'deleting');
    assert.deepEqual(await service.executeDelete(active.id), { assetId: active.id, deleted: true });
    assert.equal(deletedKeys.length, 1);
    const [deleted] = await app.db
      .select({ status: storageAssets.status })
      .from(storageAssets)
      .where(eq(storageAssets.id, active.id));
    assert.equal(deleted.status, 'deleted');
    await app.db.delete(jobRuns).where(eq(jobRuns.relatedEntityId, active.id));
    await app.db.delete(accounts).where(eq(accounts.id, account.id));
    await app.close();
  },
);
