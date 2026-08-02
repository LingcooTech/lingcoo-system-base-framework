import { httpError } from '../../../lib/http-error.js';
import type { IntegrationService } from '../service.js';
import { QiniuProvider, type QiniuObjectListInput } from './qiniu.js';

export class QiniuService {
  constructor(private readonly integrations: IntegrationService) {}

  private execute<T>(input: {
    connectionId: string;
    operation: string;
    actorId?: string;
    run(
      provider: QiniuProvider,
      config: Record<string, unknown>,
      credentials: Record<string, unknown>,
      signal: AbortSignal,
    ): Promise<T> | T;
    metadata(value: T): Record<string, unknown>;
    message(value: T): string;
  }) {
    return this.integrations.executeConnection({
      connectionId: input.connectionId,
      providerCode: 'qiniu',
      operation: input.operation,
      actorId: input.actorId,
      execute: async ({ provider, config, credentials, signal }) => {
        if (!(provider instanceof QiniuProvider)) {
          throw httpError(500, '七牛云 Provider 注册无效', 'ConfigurationError');
        }
        const value = await input.run(provider, config, credentials, signal);
        return { value, message: input.message(value), metadata: input.metadata(value) };
      },
    });
  }

  listObjects(connectionId: string, input: QiniuObjectListInput, actorId?: string) {
    return this.execute({
      connectionId,
      operation: 'qiniu.object.list',
      actorId,
      run: (provider, config, credentials, signal) =>
        provider.listObjects(config, credentials, input, signal),
      message: (value) => `七牛云返回 ${value.items.length} 个对象`,
      metadata: (value) => ({ count: value.items.length, hasMore: Boolean(value.marker) }),
    });
  }

  createUploadToken(
    connectionId: string,
    input: {
      key: string;
      expiresInSeconds?: number;
      maxSizeBytes?: number;
      mimeType?: string;
    },
    actorId?: string,
  ) {
    return this.execute({
      connectionId,
      operation: 'qiniu.upload_token.create',
      actorId,
      run: (provider, config, credentials) =>
        provider.createUploadToken(config, credentials, input),
      message: (value) => `已签发对象 ${value.key} 的上传凭证`,
      metadata: (value) => ({ key: value.key, expiresInSeconds: value.expiresInSeconds }),
    });
  }

  deleteObject(connectionId: string, key: string, actorId?: string) {
    return this.execute({
      connectionId,
      operation: 'qiniu.object.delete',
      actorId,
      run: (provider, config, credentials, signal) =>
        provider.deleteObject(config, credentials, key, signal),
      message: (value) => `已删除七牛云对象 ${value.key}`,
      metadata: (value) => ({ key: value.key }),
    });
  }

  statObject(connectionId: string, key: string, actorId?: string) {
    return this.execute({
      connectionId,
      operation: 'qiniu.object.stat',
      actorId,
      run: (provider, config, credentials, signal) =>
        provider.statObject(config, credentials, key, signal),
      message: (value) => `已核验七牛云对象 ${value.key}`,
      metadata: (value) => ({ key: value.key, size: value.size, mimeType: value.mimeType }),
    });
  }

  createPrivateUrl(
    connectionId: string,
    input: { key: string; expiresInSeconds?: number },
    actorId?: string,
  ) {
    return this.execute({
      connectionId,
      operation: 'qiniu.private_url.create',
      actorId,
      run: (provider, config, credentials) => provider.createPrivateUrl(config, credentials, input),
      message: (value) => `已签发对象 ${value.key} 的临时访问地址`,
      metadata: (value) => ({ key: value.key, expiresInSeconds: value.expiresInSeconds }),
    });
  }
}
