import { Activity, Blocks, Database, MonitorCog } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchRuntime, type RuntimeInfo } from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill, type StatusTone } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

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

export function DashboardPage() {
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
    </PageFrame>
  );
}
