export interface RuntimeInfo {
  name: string;
  version: string;
  environment: string;
  surfaces: string[];
}

export interface AuthRole {
  code: string;
  name: string;
}

export interface AuthAccount {
  id: string;
  email: string;
  displayName: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  roles: AuthRole[];
  permissions: string[];
}

export interface AccessAccount extends Omit<AuthAccount, 'permissions'> {
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

  return response.json() as Promise<T>;
}

export function fetchRuntime(): Promise<RuntimeInfo> {
  return apiRequest<RuntimeInfo>('/api/system/runtime');
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
