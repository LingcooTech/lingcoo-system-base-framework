import { useEffect, useState } from 'react';

import {
  fetchAccessAccounts,
  fetchAccessPermissions,
  fetchAccessRoles,
  type AccessAccount,
  type AccessPermission,
  type AccessRole,
} from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

const accountColumns: DataTableColumn<AccessAccount>[] = [
  {
    key: 'account',
    header: '账号',
    cell: (account) => (
      <div className="table-primary">
        <strong>{account.displayName}</strong>
        <small>{account.email}</small>
      </div>
    ),
  },
  {
    key: 'roles',
    header: '角色',
    cell: (account) => account.roles.map((role) => role.name).join('、') || '未分配',
  },
  {
    key: 'status',
    header: '状态',
    align: 'right',
    cell: (account) => (
      <StatusPill tone={account.status === 'active' ? 'ok' : 'danger'}>
        {account.status === 'active' ? '启用' : '停用'}
      </StatusPill>
    ),
  },
];

const roleColumns: DataTableColumn<AccessRole>[] = [
  {
    key: 'role',
    header: '角色',
    cell: (role) => (
      <div className="table-primary">
        <strong>{role.name}</strong>
        <small>{role.code}</small>
      </div>
    ),
  },
  {
    key: 'description',
    header: '用途',
    cell: (role) => role.description ?? '自定义角色',
  },
  {
    key: 'permissions',
    header: '权限数',
    align: 'right',
    cell: (role) => String(role.permissions.length),
  },
];

export function AccessPage() {
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    Promise.all([fetchAccessAccounts(), fetchAccessRoles(), fetchAccessPermissions()])
      .then(([accountItems, roleItems, permissionItems]) => {
        setAccounts(accountItems);
        setRoles(roleItems);
        setPermissions(permissionItems);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <PageFrame section={sections.access}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>系统账号</span>
          <strong>{status === 'ready' ? accounts.length : '—'}</strong>
          <small>统一身份主体</small>
        </article>
        <article className="metric-card">
          <span>角色</span>
          <strong>{status === 'ready' ? roles.length : '—'}</strong>
          <small>支持多角色分配</small>
        </article>
        <article className="metric-card">
          <span>权限</span>
          <strong>{status === 'ready' ? permissions.length : '—'}</strong>
          <small>资源动作命名</small>
        </article>
        <article className="metric-card">
          <span>会话</span>
          <strong>JWT</strong>
          <small>HttpOnly · 可撤销</small>
        </article>
      </div>
      {status === 'error' ? (
        <ResourceSection title="身份服务">
          <p className="section-message error">身份与权限数据加载失败，请稍后重试。</p>
        </ResourceSection>
      ) : (
        <>
          <ResourceSection
            title="系统账号"
            description="账号是稳定身份主体；行业资料通过领域模块关联。"
          >
            <DataTable
              columns={accountColumns}
              getRowKey={(account) => account.id}
              rows={accounts}
            />
          </ResourceSection>
          <ResourceSection
            title="角色权限"
            description="内置角色保持通用语义，自定义领域角色通过 API 扩展。"
          >
            <DataTable columns={roleColumns} getRowKey={(role) => role.id} rows={roles} />
          </ResourceSection>
        </>
      )}
    </PageFrame>
  );
}
