export interface RuntimeInfo {
  name: string;
  version: string;
  environment: string;
  surfaces: string[];
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
