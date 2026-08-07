import {
  DataTable,
  PageFrame,
  ResourceSection,
  StatusPill,
  type DataTableColumn,
} from '@lingcoo/frame-admin/shared';
import { sections } from '../lib/foundation';

type ModuleRow = {
  id: string;
  name: string;
  kind: string;
  status: string;
};

const rows: ModuleRow[] = [
  { id: 'system', name: 'system', kind: '框架内置模块', status: '已启用' },
  { id: 'auth', name: 'auth', kind: '框架内置模块', status: '已启用' },
  { id: 'access', name: 'access', kind: '框架内置模块', status: '已启用' },
  { id: 'settings', name: 'settings', kind: '框架内置模块', status: '已启用' },
  { id: 'audit', name: 'audit', kind: '框架内置模块', status: '已启用' },
  { id: 'metadata', name: 'metadata', kind: '框架内置模块', status: '已启用' },
  { id: 'search', name: 'search', kind: '框架内置模块', status: '已启用' },
  { id: 'data-exchange', name: 'data-exchange', kind: '框架内置模块', status: '已启用' },
  { id: 'integrations', name: 'integrations', kind: '框架内置模块', status: '已启用' },
  { id: 'jobs', name: 'jobs', kind: '框架内置模块', status: '已启用' },
  { id: 'notifications', name: 'notifications', kind: '框架内置模块', status: '已启用' },
  { id: 'assets', name: 'assets', kind: '框架内置模块', status: '已启用' },
  { id: 'observability', name: 'observability', kind: '框架内置模块', status: '已启用' },
  { id: 'presentation', name: 'presentation', kind: '框架内置模块', status: '已启用' },
  { id: 'cms', name: 'frame-cms', kind: '一方扩展', status: '已启用' },
];

const columns: DataTableColumn<ModuleRow>[] = [
  { key: 'name', header: '模块', cell: (row) => <code>{row.name}</code> },
  { key: 'kind', header: '类型', cell: (row) => row.kind },
  {
    key: 'status',
    header: '状态',
    align: 'right',
    cell: (row) => <StatusPill tone="ok">{row.status}</StatusPill>,
  },
];

export function ModulesPage() {
  return (
    <PageFrame section={sections.modules}>
      <ResourceSection
        title="已注册模块"
        description="基础模块与一方扩展由组合根显式安装；行业能力使用相同扩展契约接入。"
      >
        <DataTable columns={columns} getRowKey={(row) => row.id} rows={rows} />
      </ResourceSection>
    </PageFrame>
  );
}
