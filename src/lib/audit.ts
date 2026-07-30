import type { Database } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(db: Database, event: AuditEvent): Promise<void> {
  await db.insert(auditLogs).values({
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    actorId: event.actorId,
    metadata: event.metadata,
  });
}
