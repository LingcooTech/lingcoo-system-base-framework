import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';

import { AdminLink } from './router.js';
import {
  DataTable,
  PageFrame,
  ResourceSection,
  StatusPill,
  type DataTableColumn,
} from './shared.js';

export interface AdminSystemExtensionSummary {
  id: string;
  version: string;
  surfaces: string[];
  contributions: {
    permissions: number;
    settings: number;
    serverRoutes: number;
    jobs: number;
    subscriptions: number;
    migrations: number;
    adminRoutes: number;
    webRoutes: number;
  };
}

export interface AdminSystemMigrationSourceSummary {
  id: string;
  extensionId: string;
  declaredCount: number;
  appliedCount: number;
  pendingCount: number;
}

export interface AdminSystemRuntimeSummary {
  name: string;
  version: string;
  environment: string;
  surfaces: string[];
  system: { id: string; version: string };
  frame: { version: string; apiVersion: string };
  extensions: AdminSystemExtensionSummary[];
  migrations: {
    status: 'current' | 'pending' | 'unavailable';
    declaredCount: number;
    appliedCount: number;
    pendingCount: number;
    ledgerCount: number;
    sources: AdminSystemMigrationSourceSummary[];
  };
}

export interface AdminSystemServiceSummary {
  id: string;
  serviceType: 'api' | 'worker';
  instanceId: string;
  version: string;
  status: 'healthy' | 'stopping' | 'degraded';
  startedAt: string;
  lastSeenAt: string;
  fresh: boolean;
}

export interface AdminSystemObservabilitySummary {
  runtime: {
    startedAt: string;
    uptimeSeconds: number;
    activeRequests: number;
    requestCount: number;
    errorCount: number;
    errorRate: number;
    averageDurationMs: number;
    p95DurationMs: number;
    memoryRssBytes: number;
    heapUsedBytes: number;
  };
  incidents: { open: number; resolved: number };
  services: AdminSystemServiceSummary[];
  database: { status: 'healthy' | 'unavailable'; latencyMs: number };
  metricsEndpointEnabled: boolean;
}

export interface AdminSystemOperationsSummary {
  jobs: Record<string, number>;
  outboxTotal: number;
}

export interface AdminSystemInfoClient {
  loadRuntime(): Promise<AdminSystemRuntimeSummary>;
  loadObservability?(): Promise<AdminSystemObservabilitySummary>;
  loadOperations?(): Promise<AdminSystemOperationsSummary>;
}

export interface AdminSystemManagementLink {
  href: string;
  title: string;
  description: string;
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
}

export interface AdminSystemInfoPageProps {
  client: AdminSystemInfoClient;
  canReadObservability?: boolean;
  canReadOperations?: boolean;
  managementLinks?: readonly AdminSystemManagementLink[];
  initialRuntime?: AdminSystemRuntimeSummary;
  initialObservability?: AdminSystemObservabilitySummary;
  initialOperations?: AdminSystemOperationsSummary;
}

function formatBytes(value: number): string {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(value: number): string {
  return value < 1 ? '< 1 ms' : `${value.toFixed(1)} ms`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86_400)} 天`;
}

function migrationLabel(status: AdminSystemRuntimeSummary['migrations']['status']) {
  return status === 'current' ? '已同步' : status === 'pending' ? '待迁移' : '账本不可用';
}

export function AdminSystemInfoPage({
  client,
  canReadObservability = false,
  canReadOperations = false,
  managementLinks = [],
  initialRuntime,
  initialObservability,
  initialOperations,
}: AdminSystemInfoPageProps) {
  const [runtime, setRuntime] = useState<AdminSystemRuntimeSummary | null>(initialRuntime ?? null);
  const [observability, setObservability] = useState<AdminSystemObservabilitySummary | null>(
    initialObservability ?? null,
  );
  const [operations, setOperations] = useState<AdminSystemOperationsSummary | null>(
    initialOperations ?? null,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(!initialRuntime);

  useEffect(() => {
    let active = true;
    const requests: Promise<void>[] = [
      client
        .loadRuntime()
        .then((value) => {
          if (active) setRuntime(value);
        })
        .catch(() => {
          if (active) setErrors((current) => [...current, '系统运行摘要加载失败']);
        }),
    ];
    if (canReadObservability && client.loadObservability) {
      requests.push(
        client
          .loadObservability()
          .then((value) => {
            if (active) setObservability(value);
          })
          .catch(() => {
            if (active) setErrors((current) => [...current, '运行状态加载失败']);
          }),
      );
    }
    if (canReadOperations && client.loadOperations) {
      requests.push(
        client
          .loadOperations()
          .then((value) => {
            if (active) setOperations(value);
          })
          .catch(() => {
            if (active) setErrors((current) => [...current, '任务与事件摘要加载失败']);
          }),
      );
    }
    Promise.allSettled(requests).then(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [canReadObservability, canReadOperations, client, initialRuntime]);

  const extensionColumns = useMemo<DataTableColumn<AdminSystemExtensionSummary>[]>(
    () => [
      {
        key: 'extension',
        header: '扩展',
        cell: (extension) => (
          <div className="admin-system-info__primary">
            <strong>{extension.id}</strong>
            <small>v{extension.version}</small>
          </div>
        ),
      },
      {
        key: 'surfaces',
        header: '运行面',
        cell: (extension) => extension.surfaces.join(' · ') || '声明层',
      },
      {
        key: 'routes',
        header: '路由',
        cell: (extension) =>
          String(
            extension.contributions.serverRoutes +
              extension.contributions.adminRoutes +
              extension.contributions.webRoutes,
          ),
      },
      {
        key: 'workers',
        header: 'Worker',
        cell: (extension) =>
          `${extension.contributions.jobs} Job · ${extension.contributions.subscriptions} Event`,
      },
      {
        key: 'migrations',
        header: '迁移',
        align: 'right',
        cell: (extension) => String(extension.contributions.migrations),
      },
    ],
    [],
  );

  const migrationStatus = runtime?.migrations.status;
  const migrationColumns = useMemo<DataTableColumn<AdminSystemMigrationSourceSummary>[]>(
    () => [
      {
        key: 'source',
        header: '迁移来源',
        cell: (source) => (
          <div className="admin-system-info__primary">
            <strong>{source.id}</strong>
            <small>{source.extensionId}</small>
          </div>
        ),
      },
      { key: 'declared', header: '已声明', cell: (source) => String(source.declaredCount) },
      { key: 'applied', header: '已应用', cell: (source) => String(source.appliedCount) },
      {
        key: 'status',
        header: '状态',
        align: 'right',
        cell: (source) =>
          migrationStatus === 'unavailable' ? (
            <StatusPill tone="danger">账本不可用</StatusPill>
          ) : (
            <StatusPill tone={source.pendingCount ? 'warn' : 'ok'}>
              {source.pendingCount ? `${source.pendingCount} 项待执行` : '已同步'}
            </StatusPill>
          ),
      },
    ],
    [migrationStatus],
  );

  const api = observability?.services.find((service) => service.serviceType === 'api');
  const worker = observability?.services.find((service) => service.serviceType === 'worker');
  const statusTone = !runtime
    ? 'danger'
    : runtime.migrations.status !== 'current' ||
        observability?.database.status === 'unavailable' ||
        (observability?.incidents.open ?? 0) > 0
      ? 'warn'
      : 'ok';

  return (
    <PageFrame
      badge={
        <StatusPill tone={statusTone}>
          {statusTone === 'ok' ? '系统正常' : statusTone === 'warn' ? '需要关注' : '摘要不可用'}
        </StatusPill>
      }
      section={{
        group: 'Frame',
        title: '系统信息',
        description: '集中查看应用版本、Frame、扩展、运行面、迁移、任务和异常状态。',
      }}
    >
      {errors.length ? (
        <div className="admin-system-info__notice" role="alert">
          <AlertTriangle aria-hidden size={16} />
          <span>{errors.join('；')}</span>
        </div>
      ) : null}
      <div className="admin-system-info__metrics">
        <article>
          <span>应用</span>
          <strong>{runtime?.system.id ?? (loading ? '读取中' : '不可用')}</strong>
          <small>{runtime ? `v${runtime.system.version} · ${runtime.environment}` : '—'}</small>
        </article>
        <article>
          <span>Frame</span>
          <strong>{runtime ? `v${runtime.frame.version}` : '—'}</strong>
          <small>{runtime ? `Extension API ${runtime.frame.apiVersion}` : '—'}</small>
        </article>
        <article>
          <span>已安装扩展</span>
          <strong>{runtime?.extensions.length ?? '—'}</strong>
          <small>来自当前 Defined System</small>
        </article>
        <article>
          <span>数据库迁移</span>
          <strong>
            {runtime
              ? `${runtime.migrations.appliedCount}/${runtime.migrations.declaredCount}`
              : '—'}
          </strong>
          <small>{runtime ? migrationLabel(runtime.migrations.status) : '—'}</small>
        </article>
      </div>

      <ResourceSection title="运行面" description="服务状态来自真实心跳和数据库探测。">
        <div className="admin-system-info__surfaces">
          <SystemSurface
            label="API"
            note={
              api
                ? `最近心跳 ${new Date(api.lastSeenAt).toLocaleString('zh-CN')}`
                : '当前请求已连接'
            }
            state={!observability || api?.fresh ? 'ok' : 'warn'}
            value={!observability ? '已连接' : api?.fresh ? '运行中' : '心跳异常'}
          />
          <SystemSurface
            label="Worker"
            note={worker ? `v${worker.version} · ${worker.instanceId}` : '未发现新鲜心跳'}
            state={!canReadObservability ? 'neutral' : worker?.fresh ? 'ok' : 'warn'}
            value={worker?.fresh ? '运行中' : canReadObservability ? '未连接' : '受权限保护'}
          />
          <SystemSurface
            label="PostgreSQL"
            note={
              observability ? formatDuration(observability.database.latencyMs) : '需要运行状态权限'
            }
            state={observability?.database.status === 'healthy' ? 'ok' : 'warn'}
            value={
              observability?.database.status === 'healthy'
                ? '正常'
                : canReadObservability
                  ? '不可用'
                  : '受权限保护'
            }
          />
          <SystemSurface
            label="Metrics"
            note={canReadObservability ? '独立访问令牌保护' : '需要运行状态权限'}
            state={canReadObservability && observability?.metricsEndpointEnabled ? 'ok' : 'neutral'}
            value={
              !canReadObservability
                ? '受权限保护'
                : observability?.metricsEndpointEnabled
                  ? '已启用'
                  : '未启用'
            }
          />
        </div>
      </ResourceSection>

      <ResourceSection
        title="扩展"
        description="只显示 Manifest 中已经声明并由当前 System 安装的能力。"
      >
        <DataTable
          columns={extensionColumns}
          emptyTitle={loading ? '正在读取扩展' : '当前系统没有安装扩展'}
          getRowKey={(extension) => extension.id}
          rows={runtime?.extensions ?? []}
        />
      </ResourceSection>

      <ResourceSection
        title="数据库迁移"
        description={
          runtime
            ? `账本共 ${runtime.migrations.ledgerCount} 条记录 · ${migrationLabel(runtime.migrations.status)}`
            : '正在读取迁移账本'
        }
      >
        <DataTable
          columns={migrationColumns}
          emptyTitle={loading ? '正在读取迁移来源' : '当前系统没有声明迁移'}
          getRowKey={(source) => source.id}
          rows={runtime?.migrations.sources ?? []}
        />
      </ResourceSection>

      {canReadObservability && observability ? (
        <ResourceSection title="运行诊断" description="进程指标会在实例重启后重新累计。">
          <dl className="admin-system-info__facts">
            <div>
              <dt>运行时间</dt>
              <dd>{formatUptime(observability.runtime.uptimeSeconds)}</dd>
            </div>
            <div>
              <dt>请求</dt>
              <dd>{observability.runtime.requestCount}</dd>
            </div>
            <div>
              <dt>P95</dt>
              <dd>{formatDuration(observability.runtime.p95DurationMs)}</dd>
            </div>
            <div>
              <dt>内存</dt>
              <dd>{formatBytes(observability.runtime.memoryRssBytes)}</dd>
            </div>
            <div>
              <dt>未解决异常</dt>
              <dd>{observability.incidents.open}</dd>
            </div>
          </dl>
        </ResourceSection>
      ) : null}

      {canReadOperations && operations ? (
        <ResourceSection title="任务与事件" description="展示持久化任务和 Outbox 的当前摘要。">
          <dl className="admin-system-info__facts">
            <div>
              <dt>等待执行</dt>
              <dd>{operations.jobs.pending ?? 0}</dd>
            </div>
            <div>
              <dt>执行中</dt>
              <dd>{operations.jobs.running ?? 0}</dd>
            </div>
            <div>
              <dt>死亡任务</dt>
              <dd>{operations.jobs.dead ?? 0}</dd>
            </div>
            <div>
              <dt>已取消</dt>
              <dd>{operations.jobs.cancelled ?? 0}</dd>
            </div>
            <div>
              <dt>Outbox 事件</dt>
              <dd>{operations.outboxTotal}</dd>
            </div>
          </dl>
        </ResourceSection>
      ) : null}

      {managementLinks.length ? (
        <ResourceSection title="管理入口" description="仅显示当前账号有权访问的 Frame 管理页面。">
          <div className="admin-system-info__links">
            {managementLinks.map(({ href, title, description, icon: Icon }) => (
              <AdminLink href={href} key={href}>
                <span>
                  {Icon ? <Icon aria-hidden size={17} /> : <CircleDashed aria-hidden size={17} />}
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ArrowRight aria-hidden size={16} />
              </AdminLink>
            ))}
          </div>
        </ResourceSection>
      ) : null}
    </PageFrame>
  );
}

function SystemSurface({
  label,
  note,
  state,
  value,
}: {
  label: string;
  note: string;
  state: 'ok' | 'warn' | 'neutral';
  value: string;
}) {
  return (
    <article>
      <span className={`admin-system-info__surface-icon admin-system-info__surface-icon--${state}`}>
        {state === 'ok' ? (
          <CheckCircle2 aria-hidden size={17} />
        ) : (
          <CircleDashed aria-hidden size={17} />
        )}
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <small>{note}</small>
      </span>
    </article>
  );
}
