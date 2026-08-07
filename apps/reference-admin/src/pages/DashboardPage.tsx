import {
  Activity,
  ArrowRight,
  Blocks,
  CircleHelp,
  Database,
  Images,
  ListChecks,
  MonitorCog,
  Waypoints,
} from 'lucide-react';
import { AdminDashboardWidgets } from '@lingcoo/frame-admin';
import { AdminLink } from '@lingcoo/frame-admin/router';
import { useEffect, useState } from 'react';

import { fetchRuntime, type RuntimeInfo } from '../api/client';
import {
  DataTable,
  PageFrame,
  ResourceSection,
  StatusPill,
  type DataTableColumn,
  type StatusTone,
} from '@lingcoo/frame-admin/shared';
import { sections } from '../lib/foundation';
import { useAdminAuth as useAuth } from '@lingcoo/frame-admin/auth';
import type { AdminAppContext } from '../extensions';

interface Surface {
  id: string;
  name: string;
  responsibility: string;
  status: string;
  tone: StatusTone;
}

const columns: DataTableColumn<Surface>[] = [
  { key: 'name', header: '运行面', cell: (row) => <strong>{row.name}</strong> },
  { key: 'responsibility', header: '职责', cell: (row) => row.responsibility },
  {
    key: 'status',
    header: '状态',
    align: 'right',
    cell: (row) => <StatusPill tone={row.tone}>{row.status}</StatusPill>,
  },
];

const metrics = [
  {
    icon: Activity,
    label: 'API 状态',
    getValue: (runtime: RuntimeInfo | null, status: 'loading' | 'ok' | 'error') =>
      status === 'ok' ? '正常' : status === 'error' ? '不可用' : '检查中',
    getNote: () => '/health',
  },
  {
    icon: Database,
    label: '数据基础',
    getValue: () => 'PostgreSQL',
    getNote: () => 'Drizzle ORM',
  },
  {
    icon: MonitorCog,
    label: '运行版本',
    getValue: (runtime: RuntimeInfo | null) => runtime?.version ?? 'development',
    getNote: (runtime: RuntimeInfo | null) => runtime?.environment ?? '',
  },
  {
    icon: Blocks,
    label: '业务模块',
    getValue: () => '0',
    getNote: () => '等待领域扩展',
  },
];

const systemAreas = [
  {
    href: '/modules',
    icon: Waypoints,
    title: '扩展与模块',
    description: '查看当前系统装载的 Frame 模块与扩展边界。',
    permission: 'admin.access',
  },
  {
    href: '/operations',
    icon: ListChecks,
    title: '任务与事件',
    description: '检查后台任务、重试状态与 Outbox 事件投影。',
    permission: 'jobs.read',
  },
  {
    href: '/observability',
    icon: Activity,
    title: '运行状态',
    description: '检查 API、Worker、数据库、指标与聚合异常。',
    permission: 'observability.read',
  },
  {
    href: '/assets',
    icon: Images,
    title: '资产管理',
    description: '直接检查文件身份、存储对象和领域引用关系。',
    permission: 'assets.read',
  },
  {
    href: '/help',
    icon: CircleHelp,
    title: 'Frame 帮助',
    description: '查看框架能力边界、扩展约束和常用控制面。',
    permission: 'admin.access',
  },
] as const;

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [apiStatus, setApiStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetchRuntime()
      .then((value) => {
        setRuntime(value);
        setApiStatus('ok');
      })
      .catch(() => setApiStatus('error'));
  }, []);

  const surfaces: Surface[] = [
    {
      id: 'api',
      name: 'Fastify API',
      responsibility: '系统运行时与领域模块宿主',
      status: apiStatus === 'ok' ? '正常' : apiStatus === 'error' ? '不可用' : '检查中',
      tone: apiStatus === 'ok' ? 'ok' : apiStatus === 'error' ? 'danger' : 'warn',
    },
    {
      id: 'admin',
      name: 'Admin UI',
      responsibility: '管理后台与资源控制台',
      status: '正常',
      tone: 'ok',
    },
    {
      id: 'public',
      name: 'Public Web',
      responsibility: '用户侧 Web 应用宿主',
      status: '正常',
      tone: 'ok',
    },
  ];

  return (
    <PageFrame section={sections.dashboard}>
      <div className="metric-grid">
        {metrics.map(({ icon: Icon, label, getValue, getNote }) => (
          <article className="metric-card" key={label}>
            <span className="metric-icon">
              <Icon size={17} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{getValue(runtime, apiStatus)}</strong>
              <small>{getNote(runtime)}</small>
            </div>
          </article>
        ))}
      </div>
      <ResourceSection title="运行面" description="基础框架只提供系统宿主，不预置行业资源。">
        <DataTable columns={columns} getRowKey={(row) => row.id} rows={surfaces} />
      </ResourceSection>
      <ResourceSection
        title="系统管理入口"
        description="这些入口只面向具备相应权限的开发与运维人员，不进入应用主导航。"
      >
        <div className="settings-hub-grid">
          {systemAreas
            .filter((area) => hasPermission(area.permission))
            .map(({ href, icon: Icon, title, description }) => (
              <AdminLink className="settings-hub-card" href={href} key={href}>
                <span className="settings-hub-card__icon">
                  <Icon aria-hidden size={18} />
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
      <div className="extension-dashboard-widgets">
        <AdminDashboardWidgets<AdminAppContext> context={{}} hasPermission={hasPermission} />
      </div>
    </PageFrame>
  );
}
