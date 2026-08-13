import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';

import type { Database } from '@lingcootech/frame-database';
import { auditLogs } from '@lingcootech/frame-database/schema';
import type {
  AuditCommandPort,
  AuditContextProvider,
  AuditEvent,
  AuditQuery,
  AuditQueryPort,
  AuditRecord,
} from './ports.js';

const auditRecordSelection = {
  id: auditLogs.id,
  action: auditLogs.action,
  resourceType: auditLogs.resourceType,
  resourceId: auditLogs.resourceId,
  actorId: auditLogs.actorId,
  requestId: auditLogs.requestId,
  metadata: auditLogs.metadata,
  createdAt: auditLogs.createdAt,
};

export class PostgresAuditCommandPort implements AuditCommandPort {
  constructor(
    private readonly database: Database,
    private readonly context: AuditContextProvider = () => undefined,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    const context = this.context();
    await this.database.insert(auditLogs).values({
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      actorId: event.actorId ?? context?.actorId,
      requestId: event.requestId ?? context?.requestId,
      metadata: event.metadata,
    });
  }
}

export class PostgresAuditQueryPort implements AuditQueryPort {
  constructor(private readonly database: Database) {}

  async list(query: AuditQuery) {
    const where = and(...this.conditions(query));
    const [totalRow] = await this.database.select({ value: count() }).from(auditLogs).where(where);
    const items = await this.database
      .select(auditRecordSelection)
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return { items, total: totalRow.value, page: query.page, pageSize: query.pageSize };
  }

  async findById(auditId: string): Promise<AuditRecord | null> {
    const [record] = await this.database
      .select(auditRecordSelection)
      .from(auditLogs)
      .where(eq(auditLogs.id, auditId))
      .limit(1);
    return record ?? null;
  }

  private conditions(query: AuditQuery): SQL[] {
    const conditions: SQL[] = [];
    if (query.search) {
      const pattern = `%${query.search}%`;
      const searchCondition = or(
        ilike(auditLogs.action, pattern),
        ilike(auditLogs.resourceType, pattern),
        ilike(auditLogs.resourceId, pattern),
        ilike(auditLogs.requestId, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.actionPrefix) conditions.push(ilike(auditLogs.action, `${query.actionPrefix}%`));
    if (query.resourceType) {
      conditions.push(eq(auditLogs.resourceType, query.resourceType));
    }
    if (query.actorId) conditions.push(eq(auditLogs.actorId, query.actorId));
    if (query.from) conditions.push(gte(auditLogs.createdAt, new Date(query.from)));
    if (query.to) conditions.push(lte(auditLogs.createdAt, new Date(query.to)));
    return conditions;
  }
}
