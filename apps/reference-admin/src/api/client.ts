import type {
  AdminSystemObservabilitySummary,
  AdminSystemOperationsSummary,
  AdminSystemRuntimeSummary,
  AdminSystemServiceSummary,
} from '@lingcootech/frame-admin/system-info';

export type RuntimeInfo = AdminSystemRuntimeSummary;

export interface AuthRole {
  code: string;
  name: string;
}

export interface AuthAccount {
  id: string;
  email: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  roles: AuthRole[];
  permissions: string[];
}

export interface AccessAccount extends Omit<AuthAccount, 'permissions'> {
  createdAt: string;
}

export interface AccountProfile {
  id: string;
  email: string;
  displayName: string;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AccountSession {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
}

export interface AccountSecurityEvent {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AccessRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export interface AccessPermission {
  code: string;
  name: string;
  description: string | null;
}

export interface SystemSetting {
  key: string;
  group: 'general' | 'localization';
  groupLabel: string;
  label: string;
  description: string;
  type: 'text' | 'email' | 'url' | 'select';
  defaultValue: string;
  options?: { label: string; value: string }[];
  value: string;
  isDefault: boolean;
  version: number;
  updatedAt: string | null;
}

export interface SystemSettingVersion {
  id: string;
  version: number;
  value: string;
  changeReason: string | null;
  createdAt: string;
  actor: { id: string; email: string; displayName: string } | null;
}

export interface AuditItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; email: string; displayName: string } | null;
}

export type ObservabilitySummary = AdminSystemObservabilitySummary;
export type ObservabilityServiceStatus = AdminSystemServiceSummary;

export interface RequestMetric {
  method: string;
  route: string;
  requestCount: number;
  errorCount: number;
  averageDurationMs: number;
  maxDurationMs: number;
}

export interface SystemIncident {
  id: string;
  category: 'request_error' | 'worker_error';
  title: string;
  severity: 'error' | 'critical';
  status: 'open' | 'resolved';
  serviceType: 'api' | 'worker';
  errorName: string;
  method: string | null;
  route: string | null;
  latestRequestId: string | null;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedBy: { id: string; email: string; displayName: string } | null;
}

export interface MetadataSummary {
  dictionaries: number;
  dictionaryItems: number;
  taxonomies: number;
  terms: number;
  assignments: number;
}

export interface MetadataDictionary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  status: 'active' | 'inactive';
  isSystem: boolean;
  itemCount: number;
}

export interface MetadataDictionaryItem {
  id: string;
  dictionaryId: string;
  code: string;
  label: string;
  value: unknown;
  description: string | null;
  sortOrder: number;
  status: 'active' | 'inactive';
}

export interface Taxonomy {
  id: string;
  code: string;
  name: string;
  kind: 'tag' | 'category';
  description: string | null;
  hierarchical: boolean;
  status: 'active' | 'inactive';
  termCount: number;
}

export interface TaxonomyTerm {
  id: string;
  taxonomyId: string;
  parentId: string | null;
  code: string;
  name: string;
  color: string | null;
  sortOrder: number;
  status: 'active' | 'inactive';
  metadata: Record<string, unknown>;
}

export interface ExchangeDataset {
  code: string;
  name: string;
  description: string;
  format: 'json';
  formatVersion: 1;
}

export interface ExchangePreview {
  valid: boolean;
  recordCount: number;
  creates: number;
  updates: number;
  errors: string[];
}

export interface ExchangeRun {
  id: string;
  datasetCode: string;
  direction: 'import' | 'export';
  format: 'json';
  status: 'succeeded' | 'failed';
  recordCount: number;
  summary: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  actor: { id: string; email: string; displayName: string } | null;
}

export interface SearchResult {
  id: string;
  source: string;
  sourceLabel: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchGroup {
  source: string;
  label: string;
  items: SearchResult[];
}

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'secret-textarea' | 'url' | 'number' | 'boolean';
  required?: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean;
}

export interface IntegrationProvider {
  code: string;
  name: string;
  category: 'communication' | 'storage' | 'payment' | 'ai' | 'developer';
  description: string;
  adapterVersion?: string;
  availability: 'available' | 'planned';
  capabilities: string[];
  configFields: IntegrationField[];
  credentialFields: IntegrationField[];
}

export interface IntegrationConnection {
  id: string;
  providerCode: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  credentialKeys: string[];
  lastTestStatus: 'success' | 'failure' | null;
  lastTestMessage: string | null;
  lastTestDurationMs: number | null;
  lastTestAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationEvent {
  id: string;
  operation: string;
  outcome: 'success' | 'failure';
  durationMs: number | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface JobRun {
  id: string;
  queue: string;
  kind: string;
  status: 'pending' | 'running' | 'succeeded' | 'dead' | 'cancelled';
  priority: number;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface OutboxEvent {
  id: string;
  topic: string;
  status: 'pending' | 'processing' | 'published' | 'dead';
  attempts: number;
  maxAttempts: number;
  aggregateType: string | null;
  aggregateId: string | null;
  lastError: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface NotificationItem {
  id: string;
  category: string;
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  status: 'unread' | 'read' | 'archived';
  ctaLabel: string | null;
  ctaUrl: string | null;
  createdAt: string;
  recipient?: { email: string; displayName: string };
}

export interface NotificationDelivery {
  id: string;
  channel: string;
  destination: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  notificationId: string;
  notificationTitle: string;
  connectionId: string | null;
  connectionName: string | null;
  jobId: string | null;
}

export interface StorageAsset {
  id: string;
  connectionId: string;
  providerCode: 'qiniu';
  objectKey: string;
  originalFilename: string;
  displayName: string;
  mediaKind: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
  mimeType: string;
  byteSize: number;
  checksum: string | null;
  visibility: 'public' | 'private';
  status: 'pending' | 'active' | 'archived' | 'deleting' | 'deleted' | 'failed';
  publicUrl: string | null;
  metadata: Record<string, unknown>;
  referenceCount: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface AssetSummary {
  status: Record<string, number>;
  kind: Record<string, number>;
  totalBytes: number;
}

export interface PresentationAsset {
  id: string;
  displayName: string;
  publicUrl: string | null;
  mimeType: string;
}

export interface PresentationProfile {
  id: string;
  displayName: string;
  shortName: string | null;
  slogan: string | null;
  fullLogoAssetId: string | null;
  squareLogoAssetId: string | null;
  darkLogoAssetId: string | null;
  faviconAssetId: string | null;
  socialImageAssetId: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  publicUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  headerNavigation: { label: string; href: string }[];
  footerLinks: { label: string; href: string }[];
  footerCopyright: string | null;
  filingInfo: string | null;
  version: number;
  updatedAt: string | null;
  assets: Record<string, PresentationAsset>;
}

export type PresentationUpdate = Omit<
  PresentationProfile,
  'id' | 'version' | 'updatedAt' | 'assets'
> & { changeReason?: string };

export interface AssetUploadIntent {
  asset: StorageAsset;
  upload: {
    token: string;
    key: string;
    uploadHost: string;
    expiresInSeconds: number;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(payload?.message ?? `请求失败 (${response.status})`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function fetchRuntime(): Promise<RuntimeInfo> {
  return apiRequest<RuntimeInfo>('/api/system/runtime');
}

export function fetchObservabilitySummary(): Promise<ObservabilitySummary> {
  return apiRequest('/api/observability/summary');
}

export async function fetchSystemOperationsSummary(): Promise<AdminSystemOperationsSummary> {
  const [jobs, outbox] = await Promise.all([
    fetchJobSummary(),
    apiRequest<{ total: number }>('/api/jobs/outbox?limit=1'),
  ]);
  return { jobs, outboxTotal: outbox.total };
}

export async function fetchRequestMetrics(): Promise<RequestMetric[]> {
  return (await apiRequest<{ items: RequestMetric[] }>('/api/observability/requests')).items;
}

export async function fetchSystemIncidents(): Promise<SystemIncident[]> {
  return (await apiRequest<{ items: SystemIncident[] }>('/api/observability/incidents')).items;
}

export async function updateSystemIncident(
  incidentId: string,
  status: 'open' | 'resolved',
): Promise<void> {
  await apiRequest(`/api/observability/incidents/${incidentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function login(email: string, password: string): Promise<AuthAccount> {
  const response = await apiRequest<{ account: AuthAccount }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.account;
}

export async function logout(): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function fetchCurrentAccount(): Promise<AuthAccount> {
  const response = await apiRequest<{ account: AuthAccount }>('/api/auth/me');
  return response.account;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchAccessAccounts(): Promise<AccessAccount[]> {
  return (await apiRequest<{ items: AccessAccount[] }>('/api/access/accounts')).items;
}

export async function fetchAccessRoles(): Promise<AccessRole[]> {
  return (await apiRequest<{ items: AccessRole[] }>('/api/access/roles')).items;
}

export async function fetchAccessPermissions(): Promise<AccessPermission[]> {
  return (await apiRequest<{ items: AccessPermission[] }>('/api/access/permissions')).items;
}

export async function createAccessAccount(input: {
  email: string;
  displayName: string;
  setupMethod: 'invitation' | 'temporary_password';
  password?: string;
  roleCodes: string[];
}): Promise<void> {
  await apiRequest('/api/access/accounts', { method: 'POST', body: JSON.stringify(input) });
}

export async function resendAccessAccountInvitation(accountId: string): Promise<void> {
  await apiRequest(`/api/access/accounts/${accountId}/invitation`, { method: 'POST' });
}

export async function fetchAccountProfile(): Promise<AccountProfile> {
  return (await apiRequest<{ profile: AccountProfile }>('/api/account/profile')).profile;
}

export async function updateAccountProfile(input: {
  displayName: string;
  avatarAssetId: string | null;
}): Promise<AccountProfile> {
  return (
    await apiRequest<{ profile: AccountProfile }>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  ).profile;
}

export async function requestEmailVerification(): Promise<void> {
  await apiRequest('/api/account/email-verification', { method: 'POST' });
}

export async function fetchAccountSessions(): Promise<AccountSession[]> {
  return (await apiRequest<{ items: AccountSession[] }>('/api/account/sessions')).items;
}

export async function revokeAccountSession(sessionId: string): Promise<void> {
  await apiRequest(`/api/account/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function revokeOtherAccountSessions(): Promise<number> {
  return (
    await apiRequest<{ count: number }>('/api/account/sessions/revoke-others', {
      method: 'POST',
    })
  ).count;
}

export async function fetchAccountSecurityEvents(): Promise<AccountSecurityEvent[]> {
  return (await apiRequest<{ items: AccountSecurityEvent[] }>('/api/account/security-events'))
    .items;
}

export async function updateAccessAccount(
  accountId: string,
  input: { displayName?: string; status?: 'active' | 'suspended'; roleCodes?: string[] },
): Promise<void> {
  await apiRequest(`/api/access/accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function createAccessRole(input: {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
}): Promise<void> {
  await apiRequest('/api/access/roles', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateAccessRole(
  roleId: string,
  input: { name?: string; description?: string; permissions?: string[] },
): Promise<void> {
  await apiRequest(`/api/access/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchSystemSettings(): Promise<SystemSetting[]> {
  return (await apiRequest<{ items: SystemSetting[] }>('/api/system/settings')).items;
}

export async function fetchPresentation(): Promise<PresentationProfile> {
  return (await apiRequest<{ presentation: PresentationProfile }>('/api/presentation'))
    .presentation;
}

export async function updatePresentation(input: PresentationUpdate): Promise<PresentationProfile> {
  return (
    await apiRequest<{ presentation: PresentationProfile }>('/api/presentation', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  ).presentation;
}

export async function updateSystemSetting(
  key: string,
  value: string,
  reason?: string,
): Promise<void> {
  await apiRequest(`/api/system/settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ value, ...(reason ? { reason } : {}) }),
  });
}

export async function fetchSystemSettingHistory(key: string): Promise<SystemSettingVersion[]> {
  return (
    await apiRequest<{ items: SystemSettingVersion[] }>(
      `/api/system/settings/${encodeURIComponent(key)}/history`,
    )
  ).items;
}

export async function fetchAuditItems(filters?: {
  search?: string;
  resourceType?: string;
  page?: number;
}): Promise<{ items: AuditItem[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.resourceType) params.set('resourceType', filters.resourceType);
  if (filters?.page) params.set('page', String(filters.page));
  const query = params.size ? `?${params.toString()}` : '';
  return apiRequest(`/api/audit${query}`);
}

export async function fetchMetadataSummary(): Promise<MetadataSummary> {
  return apiRequest('/api/metadata/summary');
}

export async function fetchMetadataDictionaries(): Promise<MetadataDictionary[]> {
  return (await apiRequest<{ items: MetadataDictionary[] }>('/api/metadata/dictionaries')).items;
}

export async function createMetadataDictionary(input: {
  code: string;
  name: string;
  description?: string;
  valueType: MetadataDictionary['valueType'];
}): Promise<void> {
  await apiRequest('/api/metadata/dictionaries', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateMetadataDictionary(
  code: string,
  input: {
    name?: string;
    description?: string;
    status?: MetadataDictionary['status'];
  },
): Promise<void> {
  await apiRequest(`/api/metadata/dictionaries/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchMetadataDictionaryItems(
  code: string,
): Promise<MetadataDictionaryItem[]> {
  return (
    await apiRequest<{ items: MetadataDictionaryItem[] }>(
      `/api/metadata/dictionaries/${encodeURIComponent(code)}/items`,
    )
  ).items;
}

export async function createMetadataDictionaryItem(
  code: string,
  input: {
    code: string;
    label: string;
    value: unknown;
    description?: string;
    sortOrder: number;
    status: MetadataDictionaryItem['status'];
  },
): Promise<void> {
  await apiRequest(`/api/metadata/dictionaries/${encodeURIComponent(code)}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMetadataDictionaryItem(
  code: string,
  itemId: string,
  input: {
    label?: string;
    value?: unknown;
    description?: string;
    sortOrder?: number;
    status?: MetadataDictionaryItem['status'];
  },
): Promise<void> {
  await apiRequest(`/api/metadata/dictionaries/${encodeURIComponent(code)}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchTaxonomies(): Promise<Taxonomy[]> {
  return (await apiRequest<{ items: Taxonomy[] }>('/api/metadata/taxonomies')).items;
}

export async function createTaxonomy(input: {
  code: string;
  name: string;
  kind: Taxonomy['kind'];
  description?: string;
  hierarchical: boolean;
}): Promise<void> {
  await apiRequest('/api/metadata/taxonomies', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateTaxonomy(
  code: string,
  input: {
    name?: string;
    description?: string;
    status?: Taxonomy['status'];
  },
): Promise<void> {
  await apiRequest(`/api/metadata/taxonomies/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchTaxonomyTerms(code: string): Promise<TaxonomyTerm[]> {
  return (
    await apiRequest<{ items: TaxonomyTerm[] }>(
      `/api/metadata/taxonomies/${encodeURIComponent(code)}/terms`,
    )
  ).items;
}

export async function createTaxonomyTerm(
  code: string,
  input: {
    code: string;
    name: string;
    parentId?: string | null;
    color?: string | null;
    sortOrder: number;
    status: TaxonomyTerm['status'];
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  await apiRequest(`/api/metadata/taxonomies/${encodeURIComponent(code)}/terms`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTaxonomyTerm(
  code: string,
  termId: string,
  input: {
    name?: string;
    parentId?: string | null;
    color?: string | null;
    sortOrder?: number;
    status?: TaxonomyTerm['status'];
  },
): Promise<void> {
  await apiRequest(`/api/metadata/taxonomies/${encodeURIComponent(code)}/terms/${termId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchExchangeDatasets(): Promise<ExchangeDataset[]> {
  return (await apiRequest<{ items: ExchangeDataset[] }>('/api/data-exchange/datasets')).items;
}

export async function fetchExchangeRuns(): Promise<ExchangeRun[]> {
  return (await apiRequest<{ items: ExchangeRun[] }>('/api/data-exchange/runs')).items;
}

export async function exportExchangeDataset(code: string): Promise<Record<string, unknown>> {
  return apiRequest(`/api/data-exchange/datasets/${encodeURIComponent(code)}/export`);
}

export async function previewExchangeImport(
  code: string,
  document: unknown,
): Promise<ExchangePreview> {
  return (
    await apiRequest<{ preview: ExchangePreview }>(
      `/api/data-exchange/datasets/${encodeURIComponent(code)}/preview`,
      { method: 'POST', body: JSON.stringify({ document }) },
    )
  ).preview;
}

export async function applyExchangeImport(
  code: string,
  document: unknown,
): Promise<ExchangePreview> {
  return (
    await apiRequest<{ result: ExchangePreview }>(
      `/api/data-exchange/datasets/${encodeURIComponent(code)}/import`,
      { method: 'POST', body: JSON.stringify({ document }) },
    )
  ).result;
}

export async function searchResources(query: string): Promise<SearchGroup[]> {
  return (await apiRequest<{ groups: SearchGroup[] }>(`/api/search?q=${encodeURIComponent(query)}`))
    .groups;
}

export async function fetchIntegrationProviders(): Promise<IntegrationProvider[]> {
  return (await apiRequest<{ items: IntegrationProvider[] }>('/api/integrations/providers')).items;
}

export async function fetchIntegrationConnections(): Promise<IntegrationConnection[]> {
  return (await apiRequest<{ items: IntegrationConnection[] }>('/api/integrations/connections'))
    .items;
}

export async function createIntegrationConnection(input: {
  providerCode: string;
  name: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
}): Promise<IntegrationConnection> {
  return (
    await apiRequest<{ connection: IntegrationConnection }>('/api/integrations/connections', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).connection;
}

export async function updateIntegrationConnection(
  connectionId: string,
  input: {
    name?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
  },
): Promise<IntegrationConnection> {
  return (
    await apiRequest<{ connection: IntegrationConnection }>(
      `/api/integrations/connections/${connectionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    )
  ).connection;
}

export async function testIntegrationConnection(
  connectionId: string,
): Promise<{ ok: boolean; message: string; durationMs: number }> {
  return (
    await apiRequest<{ result: { ok: boolean; message: string; durationMs: number } }>(
      `/api/integrations/connections/${connectionId}/test`,
      { method: 'POST' },
    )
  ).result;
}

export async function sendSmtpTestEmail(
  connectionId: string,
  input: { to: string; subject: string; text: string },
): Promise<{
  sent: boolean;
  to: string;
  from: string;
  subject: string;
  messageId: string | null;
}> {
  return (
    await apiRequest<{
      result: {
        sent: boolean;
        to: string;
        from: string;
        subject: string;
        messageId: string | null;
      };
    }>(`/api/integrations/connections/${connectionId}/smtp/send-test`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).result;
}

export interface QiniuObjectItem {
  key: string;
  hash: string;
  size: number;
  mimeType: string;
  putTime: number;
}

export async function fetchQiniuObjects(connectionId: string): Promise<QiniuObjectItem[]> {
  return (
    await apiRequest<{ items: QiniuObjectItem[] }>(
      `/api/integrations/connections/${connectionId}/qiniu/objects?limit=50`,
    )
  ).items;
}

export async function sendOpenRouterTest(
  connectionId: string,
  prompt: string,
): Promise<{ model: string; content: string; usage: { totalTokens: number } | null }> {
  return (
    await apiRequest<{
      result: {
        model: string;
        content: string;
        usage: { totalTokens: number } | null;
      };
    }>(`/api/integrations/connections/${connectionId}/openrouter/chat-test`, {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 500,
      }),
    })
  ).result;
}

export async function fetchIntegrationEvents(connectionId: string): Promise<IntegrationEvent[]> {
  return (
    await apiRequest<{ items: IntegrationEvent[] }>(
      `/api/integrations/connections/${connectionId}/events`,
    )
  ).items;
}

export async function fetchJobs(): Promise<{ items: JobRun[]; total: number }> {
  return apiRequest('/api/jobs?limit=50');
}

export async function fetchJobSummary(): Promise<Record<string, number>> {
  return (await apiRequest<{ counts: Record<string, number> }>('/api/jobs/summary')).counts;
}

export async function retryJob(jobId: string): Promise<void> {
  await apiRequest(`/api/jobs/${jobId}/retry`, { method: 'POST' });
}

export async function cancelJob(jobId: string): Promise<void> {
  await apiRequest(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
}

export async function fetchOutboxEvents(): Promise<{ items: OutboxEvent[]; total: number }> {
  return apiRequest('/api/jobs/outbox?limit=30');
}

export async function fetchMyNotifications(): Promise<{
  items: NotificationItem[];
  total: number;
}> {
  return apiRequest('/api/notifications/me?limit=30');
}

export async function fetchAdminNotifications(): Promise<{
  items: NotificationItem[];
  total: number;
}> {
  return apiRequest('/api/notifications/admin?limit=50');
}

export async function fetchNotificationDeliveries(): Promise<{
  items: NotificationDelivery[];
  total: number;
}> {
  return apiRequest('/api/notifications/deliveries?limit=50');
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  return (await apiRequest<{ unreadCount: number }>('/api/notifications/me/unread-count'))
    .unreadCount;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiRequest(`/api/notifications/${notificationId}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest('/api/notifications/read-all', { method: 'POST' });
}

export async function archiveNotification(notificationId: string): Promise<void> {
  await apiRequest(`/api/notifications/${notificationId}/archive`, { method: 'POST' });
}

export async function publishAnnouncement(input: {
  title: string;
  body: string;
  level: 'info' | 'success' | 'warning' | 'error';
  sendEmail: boolean;
  smtpConnectionId?: string;
}): Promise<{ broadcastId: string; recipientCount: number }> {
  return (
    await apiRequest<{ result: { broadcastId: string; recipientCount: number } }>(
      '/api/notifications/announcements',
      { method: 'POST', body: JSON.stringify(input) },
    )
  ).result;
}

export async function fetchAssets(): Promise<{ items: StorageAsset[]; total: number }> {
  return apiRequest('/api/assets?limit=100');
}

export async function fetchAssetSummary(): Promise<AssetSummary> {
  return apiRequest('/api/assets/summary');
}

export async function createAssetUploadIntent(input: {
  connectionId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  visibility: 'public' | 'private';
}): Promise<AssetUploadIntent> {
  return apiRequest('/api/assets/upload-intents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function uploadAssetFile(intent: AssetUploadIntent, file: File): Promise<void> {
  const form = new FormData();
  form.set('token', intent.upload.token);
  form.set('key', intent.upload.key);
  form.set('file', file);
  const response = await fetch(intent.upload.uploadHost, { method: 'POST', body: form });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `云存储上传失败 (${response.status})`);
  }
}

export async function completeAssetUpload(assetId: string): Promise<StorageAsset> {
  return (
    await apiRequest<{ asset: StorageAsset }>(`/api/assets/${assetId}/complete`, {
      method: 'POST',
    })
  ).asset;
}

export async function fetchAssetAccessUrl(assetId: string): Promise<string> {
  return (await apiRequest<{ result: { url: string } }>(`/api/assets/${assetId}/access-url`)).result
    .url;
}

export async function archiveAsset(assetId: string): Promise<void> {
  await apiRequest(`/api/assets/${assetId}/archive`, { method: 'POST' });
}

export async function restoreAsset(assetId: string): Promise<void> {
  await apiRequest(`/api/assets/${assetId}/restore`, { method: 'POST' });
}

export async function deleteAsset(assetId: string): Promise<void> {
  await apiRequest(`/api/assets/${assetId}`, { method: 'DELETE' });
}
