import type { Database } from '../db/client.js';
import { auditLogs } from '../db/schema.js';
import { getRequestContext } from './request-context.js';

export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export async function recordAuditEvent(db: Database, event: AuditEvent): Promise<void> {
  const requestContext = getRequestContext();
  await db.insert(auditLogs).values({
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    actorId: event.actorId ?? requestContext?.actorId,
    requestId: event.requestId ?? requestContext?.requestId,
    metadata: event.metadata,
  });
}
