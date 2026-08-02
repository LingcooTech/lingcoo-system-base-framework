import { Button } from '@lingcoo/frame-ui/button';
import { useCallback, useEffect, useState } from 'react';

import {
  fetchObservabilitySummary,
  fetchRequestMetrics,
  fetchSystemIncidents,
  updateSystemIncident,
  type ObservabilitySummary,
  type RequestMetric,
  type SystemIncident,
} from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

function bytes(value: number): string {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function duration(value: number): string {
  return value < 1 ? '< 1 ms' : `${value.toFixed(1)} ms`;
}

export function ObservabilityPage() {
  const [summary, setSummary] = useState<ObservabilitySummary | null>(null);
  const [requests, setRequests] = useState<RequestMetric[]>([]);
  const [incidents, setIncidents] = useState<SystemIncident[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextRequests, nextIncidents] = await Promise.all([
        fetchObservabilitySummary(),
        fetchRequestMetrics(),
        fetchSystemIncidents(),
      ]);
      setSummary(nextSummary);
      setRequests(nextRequests);
      setIncidents(nextIncidents);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '运行状态加载失败');
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  async function toggleIncident(incident: SystemIncident) {
    setBusyId(incident.id);
    try {
      await updateSystemIncident(incident.id, incident.status === 'open' ? 'resolved' : 'open');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '异常状态更新失败');
    } finally {
      setBusyId('');
    }
  }

  const requestColumns: DataTableColumn<RequestMetric>[] = [
    {
      key: 'route',
      header: '请求路由',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.route}</strong>
          <small>{item.method}</small>
        </div>
      ),
    },
    { key: 'count', header: '请求数', cell: (item) => item.requestCount },
    {
      key: 'errors',
      header: '5xx',
      cell: (item) => (
        <StatusPill tone={item.errorCount ? 'danger' : 'ok'}>{String(item.errorCount)}</StatusPill>
      ),
    },
    { key: 'average', header: '平均耗时', cell: (item) => duration(item.averageDurationMs) },
    {
      key: 'max',
      header: '最大耗时',
      align: 'right',
      cell: (item) => duration(item.maxDurationMs),
    },
  ];

  const incidentColumns: DataTableColumn<SystemIncident>[] = [
    {
      key: 'incident',
      header: '异常分组',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.title}</strong>
          <small>
            {item.errorName} · {item.latestRequestId ?? '无 Request ID'}
          </small>
        </div>
      ),
    },
    {
      key: 'service',
      header: '服务',
      cell: (item) => `${item.serviceType.toUpperCase()} · ${item.category}`,
    },
    { key: 'count', header: '次数', cell: (item) => item.occurrenceCount },
    {
      key: 'status',
      header: '状态',
      cell: (item) => (
        <StatusPill tone={item.status === 'open' ? 'danger' : 'ok'}>{item.status}</StatusPill>
      ),
    },
    {
      key: 'time',
      header: '最近发生',
      cell: (item) => new Date(item.lastSeenAt).toLocaleString('zh-CN'),
    },
    {
      key: 'action',
      header: '操作',
      align: 'right',
      cell: (item) => (
        <Button
          loading={busyId === item.id}
          onClick={() => void toggleIncident(item)}
          size="sm"
          variant="ghost"
        >
          {item.status === 'open' ? '标记已解决' : '重新打开'}
        </Button>
      ),
    },
  ];

  return (
    <PageFrame section={sections.observability}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>服务状态</span>
          <strong>{summary?.services.filter((service) => service.fresh).length ?? 0}</strong>
          <small>API / Worker 新鲜心跳</small>
        </article>
        <article className="metric-card">
          <span>未解决异常</span>
          <strong>{summary?.incidents.open ?? 0}</strong>
          <small>相同错误按指纹聚合</small>
        </article>
        <article className="metric-card">
          <span>P95 请求耗时</span>
          <strong>{duration(summary?.runtime.p95DurationMs ?? 0)}</strong>
          <small>{summary?.runtime.requestCount ?? 0} 次进程内请求</small>
        </article>
        <article className="metric-card">
          <span>内存占用</span>
          <strong>{bytes(summary?.runtime.memoryRssBytes ?? 0)}</strong>
          <small>Heap {bytes(summary?.runtime.heapUsedBytes ?? 0)}</small>
        </article>
      </div>
      {error ? <p className="integration-notice error">{error}</p> : null}
      <ResourceSection
        title="服务心跳"
        description={`数据库 ${summary?.database.status ?? '检测中'} · ${duration(summary?.database.latencyMs ?? 0)} · Prometheus ${summary?.metricsEndpointEnabled ? '已启用' : '未启用'}`}
      >
        <div className="observability-services">
          {(summary?.services ?? []).map((service) => (
            <article className="observability-service" key={service.id}>
              <div>
                <strong>{service.serviceType.toUpperCase()}</strong>
                <code>{service.instanceId}</code>
              </div>
              <StatusPill tone={service.fresh ? 'ok' : 'danger'}>
                {service.fresh ? '运行中' : service.status}
              </StatusPill>
              <small>最近心跳 {new Date(service.lastSeenAt).toLocaleString('zh-CN')}</small>
            </article>
          ))}
          {summary?.services.length === 0 ? <p className="empty-copy">暂无服务心跳</p> : null}
        </div>
      </ResourceSection>
      <ResourceSection
        title="异常聚合"
        description="只保存错误类型和路由上下文，不持久化堆栈、请求体或密钥。"
      >
        <DataTable
          columns={incidentColumns}
          emptyTitle="暂无系统异常"
          getRowKey={(item) => item.id}
          rows={incidents}
        />
      </ResourceSection>
      <ResourceSection
        title="请求指标"
        description="当前 API 实例内存中的路由级计数和耗时，重启后重新累计。"
      >
        <DataTable
          columns={requestColumns}
          emptyTitle="暂无请求指标"
          getRowKey={(item) => `${item.method}:${item.route}`}
          rows={requests}
        />
      </ResourceSection>
    </PageFrame>
  );
}
