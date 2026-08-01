import { httpError } from '../../lib/http-error.js';

export type IntegrationCategory = 'communication' | 'storage' | 'payment' | 'ai' | 'developer';
export type IntegrationFieldType =
  'text' | 'password' | 'textarea' | 'secret-textarea' | 'url' | 'number' | 'boolean';

export interface IntegrationFieldDefinition {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean;
}

export interface IntegrationProviderManifest {
  code: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  adapterVersion?: string;
  availability: 'available' | 'planned';
  capabilities: string[];
  configFields: IntegrationFieldDefinition[];
  credentialFields: IntegrationFieldDefinition[];
}

export interface ProviderTestContext {
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  signal: AbortSignal;
}

export interface ProviderTestResult {
  message: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationProvider extends Omit<
  IntegrationProviderManifest,
  'availability' | 'adapterVersion'
> {
  adapterVersion: string;
  testConnection(context: ProviderTestContext): Promise<ProviderTestResult>;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function validateProviderFields(
  fields: IntegrationFieldDefinition[],
  value: Record<string, unknown>,
  label: string,
): void {
  const knownKeys = new Set(fields.map((field) => field.key));
  const unknownKeys = Object.keys(value).filter((key) => !knownKeys.has(key));
  if (unknownKeys.length > 0) {
    throw httpError(422, `${label}包含未知字段：${unknownKeys.join('、')}`, 'ValidationError');
  }

  for (const field of fields) {
    const fieldValue = value[field.key];
    if (field.required && !hasValue(fieldValue)) {
      throw httpError(422, `${field.label}不能为空`, 'ValidationError');
    }
    if (!hasValue(fieldValue)) continue;

    const valid =
      field.type === 'number'
        ? typeof fieldValue === 'number' && Number.isFinite(fieldValue)
        : field.type === 'boolean'
          ? typeof fieldValue === 'boolean'
          : typeof fieldValue === 'string';
    if (!valid) {
      throw httpError(422, `${field.label}格式无效`, 'ValidationError');
    }
    if (field.type === 'url') {
      try {
        const parsed = new URL(String(fieldValue));
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        throw httpError(422, `${field.label}必须是 HTTP(S) 地址`, 'ValidationError');
      }
    }
  }
}

export class IntegrationProviderRegistry {
  private readonly manifests = new Map<string, IntegrationProviderManifest>();
  private readonly adapters = new Map<string, IntegrationProvider>();

  registerManifest(manifest: Omit<IntegrationProviderManifest, 'availability'>): void {
    if (this.manifests.has(manifest.code)) {
      throw new Error(`Integration provider already registered: ${manifest.code}`);
    }
    this.manifests.set(manifest.code, { ...manifest, availability: 'planned' });
  }

  register(provider: IntegrationProvider): void {
    const existing = this.manifests.get(provider.code);
    if (existing?.availability === 'available') {
      throw new Error(`Integration provider already registered: ${provider.code}`);
    }
    const publicManifest: IntegrationProviderManifest = {
      code: provider.code,
      name: provider.name,
      category: provider.category,
      description: provider.description,
      adapterVersion: provider.adapterVersion,
      availability: 'available',
      capabilities: provider.capabilities,
      configFields: provider.configFields,
      credentialFields: provider.credentialFields,
    };
    this.manifests.set(provider.code, publicManifest);
    this.adapters.set(provider.code, provider);
  }

  list(): IntegrationProviderManifest[] {
    return [...this.manifests.values()].sort((left, right) =>
      left.category === right.category
        ? left.name.localeCompare(right.name)
        : left.category.localeCompare(right.category),
    );
  }

  getManifest(code: string): IntegrationProviderManifest | undefined {
    return this.manifests.get(code);
  }

  getAdapter(code: string): IntegrationProvider | undefined {
    return this.adapters.get(code);
  }

  requireAdapter(code: string): IntegrationProvider {
    const manifest = this.manifests.get(code);
    if (!manifest) throw httpError(422, '未知的集成 Provider', 'ValidationError');
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw httpError(409, `${manifest.name}适配器尚未安装`, 'ConflictError');
    }
    return adapter;
  }
}
