import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { accounts, auditLogs } from '../../db/schema.js';
import { httpError } from '../../lib/http-error.js';

export interface AuditFilters {
  page: number;
  pageSize: number;
  search?: string;
  action?: string;
  resourceType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export class AuditService {
  constructor(private readonly db: Database) {}

  private conditions(filters: AuditFilters): SQL[] {
    const conditions: SQL[] = [];
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      const searchCondition = or(
        ilike(auditLogs.action, pattern),
        ilike(auditLogs.resourceType, pattern),
        ilike(auditLogs.resourceId, pattern),
        ilike(auditLogs.requestId, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.resourceType) {
      conditions.push(eq(auditLogs.resourceType, filters.resourceType));
    }
    if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, new Date(filters.to)));
    return conditions;
  }

  async list(filters: AuditFilters) {
    const where = and(...this.conditions(filters));
    const [totalRow] = await this.db.select({ value: count() }).from(auditLogs).where(where);
    const items = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        actorId: auditLogs.actorId,
        requestId: auditLogs.requestId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actor: {
          id: accounts.id,
          email: accounts.email,
          displayName: accounts.displayName,
        },
      })
      .from(auditLogs)
      .leftJoin(accounts, sql`${accounts.id}::text = ${auditLogs.actorId}`)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize);
    return { items, total: totalRow.value, page: filters.page, pageSize: filters.pageSize };
  }

  async get(auditId: string) {
    const [item] = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        actorId: auditLogs.actorId,
        requestId: auditLogs.requestId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actor: {
          id: accounts.id,
          email: accounts.email,
          displayName: accounts.displayName,
        },
      })
      .from(auditLogs)
      .leftJoin(accounts, sql`${accounts.id}::text = ${auditLogs.actorId}`)
      .where(eq(auditLogs.id, auditId))
      .limit(1);
    if (!item) throw httpError(404, '审计记录不存在', 'NotFoundError');
    return item;
  }
}
