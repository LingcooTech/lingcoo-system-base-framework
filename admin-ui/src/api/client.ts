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
