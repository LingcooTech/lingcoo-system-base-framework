export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  actorId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditContext {
  actorId?: string;
  requestId?: string;
}

export type AuditContextProvider = () => AuditContext | undefined;

export interface AuditCommandPort {
  record(event: AuditEvent): Promise<void>;
}

export interface AuditRecord {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorId: string | null;
  requestId: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface AuditQuery {
  page: number;
  pageSize: number;
  search?: string;
  action?: string;
  actionPrefix?: string;
  resourceType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface AuditPage {
  items: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditQueryPort {
  list(query: AuditQuery): Promise<AuditPage>;
  findById(auditId: string): Promise<AuditRecord | null>;
}

export function createNoopAuditCommandPort(): AuditCommandPort {
  return { async record() {} };
}

export function createNoopAuditQueryPort(): AuditQueryPort {
  return {
    async list(query) {
      return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
    async findById() {
      return null;
    },
  };
}
