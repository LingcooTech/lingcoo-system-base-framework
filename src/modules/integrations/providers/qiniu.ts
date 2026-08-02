import { createHmac } from 'node:crypto';

import { httpError } from '../../../lib/http-error.js';
import type { IntegrationProvider, ProviderTestContext } from '../provider.js';

export interface QiniuSettings {
  accessKey: string;
  secretKey: string;
  bucketName: string;
  publicBaseUrl: string;
  uploadHost: string;
  defaultPrefix: string;
}

export interface QiniuObjectListInput {
  prefix?: string;
  marker?: string;
  limit?: number;
}

export interface QiniuObjectItem {
  key: string;
  hash: string;
  size: number;
  mimeType: string;
  putTime: number;
}

export interface QiniuObjectStat {
  key: string;
  hash: string;
  size: number;
  mimeType: string;
  putTime: number;
}

function urlSafeBase64(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function sign(settings: QiniuSettings, content: string): string {
  const digest = createHmac('sha1', settings.secretKey).update(content).digest();
  return `${settings.accessKey}:${urlSafeBase64(digest)}`;
}

function parseSettings(
  config: Record<string, unknown>,
  credentials: Record<string, unknown>,
): QiniuSettings {
  const settings = {
    accessKey: String(config.accessKey ?? '').trim(),
    secretKey: String(credentials.secretKey ?? '').trim(),
    bucketName: String(config.bucketName ?? '').trim(),
    publicBaseUrl: String(config.publicBaseUrl ?? '')
      .trim()
      .replace(/\/+$/, ''),
    uploadHost: String(config.uploadHost ?? 'https://upload.qiniup.com')
      .trim()
      .replace(/\/+$/, ''),
    defaultPrefix: String(config.defaultPrefix ?? '')
      .trim()
      .replace(/^\/+|\/+$/g, ''),
  };
  if (!/^[A-Za-z0-9_-]+$/.test(settings.accessKey)) {
    throw httpError(422, '七牛云 AccessKey 格式无效', 'ValidationError');
  }
  if (!settings.secretKey) throw httpError(422, '七牛云 SecretKey 不能为空', 'ValidationError');
  if (!/^[A-Za-z0-9._-]+$/.test(settings.bucketName)) {
    throw httpError(422, '七牛云空间名称格式无效', 'ValidationError');
  }
  for (const [label, value] of [
    ['资源访问域名', settings.publicBaseUrl],
    ['上传域名', settings.uploadHost],
  ] as const) {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      throw httpError(422, `${label}必须使用 HTTPS`, 'ValidationError');
    }
  }
  return settings;
}

async function qiniuRequest<T>(
  settings: QiniuSettings,
  url: URL,
  signal: AbortSignal,
  init: RequestInit = {},
  acceptedStatuses: number[] = [],
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `QBox ${sign(settings, `${url.pathname}${url.search}\n`)}`,
      ...init.headers,
    },
    signal,
  });
  const text = await response.text();
  let payload = {} as T & { error?: string };
  if (text) {
    try {
      payload = JSON.parse(text) as T & { error?: string };
    } catch {
      payload = { error: text } as T & { error?: string };
    }
  }
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw new Error(`七牛云请求失败 (${response.status})：${payload.error ?? '未知错误'}`);
  }
  return payload;
}

export class QiniuProvider implements IntegrationProvider {
  readonly code = 'qiniu';
  readonly name = '七牛云对象存储';
  readonly category = 'storage' as const;
  readonly description = '上传凭证、对象列表、删除、私有下载签名和资源域名管理。';
  readonly adapterVersion = '1.0.0';
  readonly capabilities = [
    'object.upload-token',
    'object.list',
    'object.stat',
    'object.delete',
    'object.sign',
    'connection.test',
  ];
  readonly configFields = [
    {
      key: 'accessKey',
      label: 'AccessKey',
      type: 'text' as const,
      required: true,
    },
    {
      key: 'bucketName',
      label: '存储空间名称',
      type: 'text' as const,
      required: true,
      placeholder: 'lingcoo-assets',
    },
    {
      key: 'publicBaseUrl',
      label: '资源访问域名',
      type: 'url' as const,
      required: true,
      placeholder: 'https://assets.example.com',
      description: '必须是已绑定到该空间的 HTTPS 域名。',
    },
    {
      key: 'uploadHost',
      label: '上传域名',
      type: 'url' as const,
      required: true,
      defaultValue: 'https://upload.qiniup.com',
    },
    {
      key: 'defaultPrefix',
      label: '默认对象前缀',
      type: 'text' as const,
      placeholder: 'uploads',
      description: '用于隔离当前系统对象；不填写则直接使用对象键。',
    },
  ];
  readonly credentialFields = [
    {
      key: 'secretKey',
      label: 'SecretKey',
      type: 'password' as const,
      required: true,
      description: '加密保存且永不通过 API 回传。',
    },
  ];

  async testConnection({ config, credentials, signal }: ProviderTestContext) {
    const settings = parseSettings(config, credentials);
    const result = await this.listObjects(config, credentials, { limit: 1 }, signal);
    return {
      message: '七牛云凭据有效，存储空间可访问',
      metadata: { bucketName: settings.bucketName, objectSampleCount: result.items.length },
    };
  }

  async listObjects(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    input: QiniuObjectListInput,
    signal: AbortSignal,
  ): Promise<{ items: QiniuObjectItem[]; marker: string | null }> {
    const settings = parseSettings(config, credentials);
    const url = new URL('https://rsf.qiniuapi.com/list');
    url.searchParams.set('bucket', settings.bucketName);
    url.searchParams.set('limit', String(Math.min(Math.max(input.limit ?? 50, 1), 1000)));
    const prefix = input.prefix ?? settings.defaultPrefix;
    if (prefix) url.searchParams.set('prefix', prefix);
    if (input.marker) url.searchParams.set('marker', input.marker);
    const payload = await qiniuRequest<{
      items?: Array<{
        key?: string;
        hash?: string;
        fsize?: number;
        mimeType?: string;
        putTime?: number;
      }>;
      marker?: string;
    }>(settings, url, signal);
    return {
      items: (payload.items ?? []).flatMap((item) =>
        item.key
          ? [
              {
                key: item.key,
                hash: item.hash ?? '',
                size: item.fsize ?? 0,
                mimeType: item.mimeType ?? 'application/octet-stream',
                putTime: item.putTime ?? 0,
              },
            ]
          : [],
      ),
      marker: payload.marker || null,
    };
  }

  createUploadToken(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    input: {
      key: string;
      expiresInSeconds?: number;
      maxSizeBytes?: number;
      mimeType?: string;
    },
  ) {
    const settings = parseSettings(config, credentials);
    const key = this.resolveKey(settings, input.key);
    const expiresInSeconds = Math.min(Math.max(input.expiresInSeconds ?? 3600, 60), 86_400);
    const policy = urlSafeBase64(
      JSON.stringify({
        scope: `${settings.bucketName}:${key}`,
        deadline: Math.floor(Date.now() / 1000) + expiresInSeconds,
        insertOnly: 1,
        ...(input.maxSizeBytes ? { fsizeLimit: input.maxSizeBytes } : {}),
        ...(input.mimeType ? { mimeLimit: input.mimeType } : {}),
      }),
    );
    return {
      key,
      token: `${sign(settings, policy)}:${policy}`,
      uploadHost: settings.uploadHost,
      publicUrl: `${settings.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`,
      expiresInSeconds,
    };
  }

  async deleteObject(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    rawKey: string,
    signal: AbortSignal,
  ): Promise<{ key: string }> {
    const settings = parseSettings(config, credentials);
    const key = this.resolveKey(settings, rawKey, false);
    const entry = urlSafeBase64(`${settings.bucketName}:${key}`);
    const url = new URL(`https://rs.qiniuapi.com/delete/${entry}`);
    await qiniuRequest<Record<string, never>>(
      settings,
      url,
      signal,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      [612],
    );
    return { key };
  }

  async statObject(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    rawKey: string,
    signal: AbortSignal,
  ): Promise<QiniuObjectStat> {
    const settings = parseSettings(config, credentials);
    const key = this.resolveKey(settings, rawKey, false);
    const entry = urlSafeBase64(`${settings.bucketName}:${key}`);
    const url = new URL(`https://rs.qiniuapi.com/stat/${entry}`);
    const value = await qiniuRequest<{
      hash?: string;
      fsize?: number;
      mimeType?: string;
      putTime?: number;
    }>(settings, url, signal);
    return {
      key,
      hash: value.hash ?? '',
      size: value.fsize ?? 0,
      mimeType: value.mimeType ?? 'application/octet-stream',
      putTime: value.putTime ?? 0,
    };
  }

  createPrivateUrl(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    input: { key: string; expiresInSeconds?: number },
  ) {
    const settings = parseSettings(config, credentials);
    const key = this.resolveKey(settings, input.key, false);
    const expiresInSeconds = Math.min(Math.max(input.expiresInSeconds ?? 3600, 60), 86_400);
    const unsigned = `${settings.publicBaseUrl}/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}?e=${Math.floor(Date.now() / 1000) + expiresInSeconds}`;
    return { key, url: `${unsigned}&token=${sign(settings, unsigned)}`, expiresInSeconds };
  }

  private resolveKey(settings: QiniuSettings, rawKey: string, applyPrefix = true): string {
    const key = rawKey.trim().replace(/^\/+/, '');
    if (!key || key.length > 1024 || key.includes('\0') || key.split('/').includes('..')) {
      throw httpError(422, '对象键格式无效', 'ValidationError');
    }
    if (!applyPrefix || !settings.defaultPrefix || key.startsWith(`${settings.defaultPrefix}/`)) {
      return key;
    }
    return `${settings.defaultPrefix}/${key}`;
  }
}
