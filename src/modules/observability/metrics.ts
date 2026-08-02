interface RequestMetric {
  method: string;
  route: string;
  status: number;
  count: number;
  errors: number;
  durationMs: number;
  maxDurationMs: number;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

function label(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export class MetricsRegistry {
  private readonly startedAt = new Date();
  private readonly requests = new Map<string, RequestMetric>();
  private readonly recentDurations: number[] = [];
  private activeRequests = 0;

  beginRequest(): bigint {
    this.activeRequests += 1;
    return process.hrtime.bigint();
  }

  finishRequest(startedAt: bigint | null, method: string, route: string, status: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const durationMs = startedAt ? Number(process.hrtime.bigint() - startedAt) / 1_000_000 : 0;
    const normalizedRoute = route || 'unmatched';
    const key = `${method}|${normalizedRoute}|${status}`;
    const current = this.requests.get(key) ?? {
      method,
      route: normalizedRoute,
      status,
      count: 0,
      errors: 0,
      durationMs: 0,
      maxDurationMs: 0,
    };
    current.count += 1;
    current.errors += status >= 500 ? 1 : 0;
    current.durationMs += durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
    this.requests.set(key, current);
    this.recentDurations.push(durationMs);
    if (this.recentDurations.length > 2000) this.recentDurations.shift();
  }

  summary() {
    const rows = [...this.requests.values()];
    const requestCount = rows.reduce((sum, row) => sum + row.count, 0);
    const errorCount = rows.reduce((sum, row) => sum + row.errors, 0);
    const durationMs = rows.reduce((sum, row) => sum + row.durationMs, 0);
    const memory = process.memoryUsage();
    return {
      startedAt: this.startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      activeRequests: this.activeRequests,
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? errorCount / requestCount : 0,
      averageDurationMs: requestCount > 0 ? durationMs / requestCount : 0,
      p95DurationMs: percentile(this.recentDurations, 0.95),
      memoryRssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
    };
  }

  breakdown() {
    const aggregate = new Map<string, Omit<RequestMetric, 'status'>>();
    for (const row of this.requests.values()) {
      const key = `${row.method}|${row.route}`;
      const current = aggregate.get(key) ?? {
        method: row.method,
        route: row.route,
        count: 0,
        errors: 0,
        durationMs: 0,
        maxDurationMs: 0,
      };
      current.count += row.count;
      current.errors += row.errors;
      current.durationMs += row.durationMs;
      current.maxDurationMs = Math.max(current.maxDurationMs, row.maxDurationMs);
      aggregate.set(key, current);
    }
    return [...aggregate.values()]
      .map((row) => ({
        method: row.method,
        route: row.route,
        requestCount: row.count,
        errorCount: row.errors,
        averageDurationMs: row.count > 0 ? row.durationMs / row.count : 0,
        maxDurationMs: row.maxDurationMs,
      }))
      .sort((left, right) => right.requestCount - left.requestCount);
  }

  prometheus(openIncidents: number, healthyServices: number): string {
    const summary = this.summary();
    const lines = [
      '# HELP lingcoo_process_uptime_seconds Process uptime in seconds.',
      '# TYPE lingcoo_process_uptime_seconds gauge',
      `lingcoo_process_uptime_seconds ${summary.uptimeSeconds}`,
      '# HELP lingcoo_process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE lingcoo_process_resident_memory_bytes gauge',
      `lingcoo_process_resident_memory_bytes ${summary.memoryRssBytes}`,
      '# HELP lingcoo_http_active_requests Current active HTTP requests.',
      '# TYPE lingcoo_http_active_requests gauge',
      `lingcoo_http_active_requests ${summary.activeRequests}`,
      '# HELP lingcoo_http_requests_total HTTP requests by method, route and status.',
      '# TYPE lingcoo_http_requests_total counter',
    ];
    for (const row of this.requests.values()) {
      const labels = `method="${label(row.method)}",route="${label(row.route)}",status="${row.status}"`;
      lines.push(`lingcoo_http_requests_total{${labels}} ${row.count}`);
      lines.push(`lingcoo_http_request_duration_seconds_sum{${labels}} ${row.durationMs / 1000}`);
      lines.push(`lingcoo_http_request_duration_seconds_count{${labels}} ${row.count}`);
    }
    lines.push(
      '# HELP lingcoo_open_incidents Current unresolved incident groups.',
      '# TYPE lingcoo_open_incidents gauge',
      `lingcoo_open_incidents ${openIncidents}`,
      '# HELP lingcoo_healthy_services Current fresh service heartbeats.',
      '# TYPE lingcoo_healthy_services gauge',
      `lingcoo_healthy_services ${healthyServices}`,
      '',
    );
    return lines.join('\n');
  }
}
