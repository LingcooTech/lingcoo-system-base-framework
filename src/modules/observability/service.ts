import { createHash } from 'node:crypto';

import { count, desc, eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { accounts, serviceHeartbeats, systemIncidents } from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import type { MetricsRegistry } from './metrics.js';

export interface IncidentInput {
  category: 'request_error' | 'worker_error';
  serviceType: 'api' | 'worker';
  error: unknown;
  method?: string;
  route?: string;
  requestId?: string;
  severity?: 'error' | 'critical';
}

export class ObservabilityService {
  constructor(
    private readonly db: Database,
    readonly metrics: MetricsRegistry,
  ) {}

  async heartbeat(input: {
    serviceType: 'api' | 'worker';
    instanceId: string;
    version: string;
    status: 'healthy' | 'stopping' | 'degraded';
    startedAt: Date;
    metadata?: Record<string, unknown>;
  }) {
    await this.db
      .insert(serviceHeartbeats)
      .values({ ...input, metadata: input.metadata ?? {} })
      .onConflictDoUpdate({
        target: [serviceHeartbeats.serviceType, serviceHeartbeats.instanceId],
        set: {
          version: input.version,
          status: input.status,
          metadata: input.metadata ?? {},
          lastSeenAt: new Date(),
        },
      });
  }

  async captureRequestError(input: Omit<IncidentInput, 'category' | 'serviceType'>) {
    return this.captureIncident({ ...input, category: 'request_error', serviceType: 'api' });
  }

  async captureIncident(input: IncidentInput) {
    const errorName = input.error instanceof Error ? input.error.name || 'Error' : 'UnknownError';
    const method = input.method?.slice(0, 20);
    const route = input.route?.slice(0, 300);
    const fingerprint = createHash('sha256')
      .update([input.serviceType, input.category, errorName, method ?? '', route ?? ''].join('|'))
      .digest('hex');
    const title =
      input.serviceType === 'api'
        ? `API ${method ?? 'REQUEST'} ${route ?? 'unknown route'} failed`
        : `Worker ${route ?? 'operation'} failed`;
    await this.db
      .insert(systemIncidents)
      .values({
        fingerprint,
        category: input.category,
        title,
        severity: input.severity ?? 'error',
        serviceType: input.serviceType,
        errorName,
        method,
        route,
        latestRequestId: input.requestId,
      })
      .onConflictDoUpdate({
        target: systemIncidents.fingerprint,
        set: {
          occurrenceCount: sql`${systemIncidents.occurrenceCount} + 1`,
          lastSeenAt: new Date(),
          latestRequestId: input.requestId,
          severity: sql`CASE WHEN ${systemIncidents.severity} = 'critical' OR ${input.severity ?? 'error'} = 'critical' THEN 'critical' ELSE 'error' END`,
          status: 'open',
          resolvedAt: null,
          resolvedBy: null,
        },
      });
  }

  async summary() {
    const [incidents, services] = await Promise.all([this.incidentCounts(), this.services()]);
    const [databaseLatencyMs, databaseStatus] = await this.databaseProbe();
    return {
      runtime: this.metrics.summary(),
      incidents,
      services,
      database: { status: databaseStatus, latencyMs: databaseLatencyMs },
      metricsEndpointEnabled: false,
    };
  }

  async services() {
    const rows = await this.db
      .selectDistinctOn([serviceHeartbeats.serviceType])
      .from(serviceHeartbeats)
      .orderBy(serviceHeartbeats.serviceType, desc(serviceHeartbeats.lastSeenAt));
    const now = Date.now();
    return rows.map((row) => ({
      ...row,
      fresh: row.status === 'healthy' && now - row.lastSeenAt.getTime() < 45_000,
    }));
  }

  async listIncidents(status?: 'open' | 'resolved') {
    return this.db
      .select({
        id: systemIncidents.id,
        category: systemIncidents.category,
        title: systemIncidents.title,
        severity: systemIncidents.severity,
        status: systemIncidents.status,
        serviceType: systemIncidents.serviceType,
        errorName: systemIncidents.errorName,
        method: systemIncidents.method,
        route: systemIncidents.route,
        latestRequestId: systemIncidents.latestRequestId,
        occurrenceCount: systemIncidents.occurrenceCount,
        firstSeenAt: systemIncidents.firstSeenAt,
        lastSeenAt: systemIncidents.lastSeenAt,
        resolvedAt: systemIncidents.resolvedAt,
        resolvedBy: { id: accounts.id, email: accounts.email, displayName: accounts.displayName },
      })
      .from(systemIncidents)
      .leftJoin(accounts, eq(systemIncidents.resolvedBy, accounts.id))
      .where(status ? eq(systemIncidents.status, status) : undefined)
      .orderBy(desc(systemIncidents.lastSeenAt))
      .limit(100);
  }

  async setIncidentStatus(incidentId: string, status: 'open' | 'resolved', actorId: string) {
    const [incident] = await this.db
      .update(systemIncidents)
      .set({
        status,
        resolvedAt: status === 'resolved' ? new Date() : null,
        resolvedBy: status === 'resolved' ? actorId : null,
      })
      .where(eq(systemIncidents.id, incidentId))
      .returning();
    if (!incident) throw httpError(404, '系统错误记录不存在', 'NotFoundError');
    await recordAuditEvent(this.db, {
      action:
        status === 'resolved'
          ? 'observability.incident_resolved'
          : 'observability.incident_reopened',
      resourceType: 'system_incident',
      resourceId: incidentId,
      actorId,
      metadata: { fingerprint: incident.fingerprint },
    });
    return incident;
  }

  async prometheus() {
    const [counts, services] = await Promise.all([
      this.incidentCounts().catch(() => ({ open: 0, resolved: 0 })),
      this.services().catch(() => []),
    ]);
    return this.metrics.prometheus(counts.open, services.filter((service) => service.fresh).length);
  }

  private async incidentCounts() {
    const rows = await this.db
      .select({ status: systemIncidents.status, value: count() })
      .from(systemIncidents)
      .groupBy(systemIncidents.status);
    const values = Object.fromEntries(rows.map((row) => [row.status, row.value]));
    return { open: values.open ?? 0, resolved: values.resolved ?? 0 };
  }

  private async databaseProbe(): Promise<[number, 'healthy' | 'unavailable']> {
    const startedAt = performance.now();
    try {
      await this.db.execute(sql`select 1`);
      return [performance.now() - startedAt, 'healthy'];
    } catch {
      return [performance.now() - startedAt, 'unavailable'];
    }
  }
}
