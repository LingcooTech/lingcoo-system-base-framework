import { Button } from '@lingcoo/frame-ui/button';
import { Input } from '@lingcoo/frame-ui/input';
import { useToast } from '@lingcoo/frame-ui/toast';
import { useEffect, useState, type FormEvent } from 'react';

import { fetchAuditItems, type AuditItem } from '../api/client';
import { AdminPagination } from '../components/shared/AdminPagination';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { DetailDrawer } from '../components/shared/DetailDrawer';
import { FilterBar } from '../components/shared/FilterBar';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'iam.account_created': '创建账号',
    'iam.account_updated': '更新账号',
    'iam.role_created': '创建角色',
    'iam.role_updated': '更新角色',
    'system.setting_updated': '更新设置',
    'presentation.updated': '更新品牌呈现',
    'cms.content_created': '创建内容',
    'cms.content_updated': '更新内容',
    'cms.content_published': '发布内容',
    'cms.content_draft': '撤回内容',
    'cms.content_archived': '归档内容',
    'cms.content_scheduled': '设置发布计划',
    'cms.content_schedule_cancelled': '取消发布计划',
    'cms.redirect_created': '创建重定向',
    'cms.redirect_updated': '更新重定向',
    'cms.redirect_deleted': '删除重定向',
    'auth.login_succeeded': '登录成功',
    'auth.login': '账号登录',
    'auth.logout': '退出登录',
    'auth.profile_updated': '更新个人资料',
    'auth.password_changed': '修改密码',
    'auth.password_reset_requested': '申请密码重置',
    'auth.password_reset_completed': '完成密码重置',
    'auth.email_verification_requested': '申请邮箱验证',
    'auth.email_verified': '完成邮箱验证',
    'auth.account_invitation_requested': '发送账号邀请',
    'auth.invitation_accepted': '接受账号邀请',
    'auth.session_revoked': '撤销登录会话',
    'auth.other_sessions_revoked': '撤销其他登录会话',
    'iam.account_invitation_resent': '重新发送账号邀请',
  };
  return labels[action] ?? action;
}

export function AuditPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(nextPage = 1, filters?: { search?: string; resourceType?: string }) {
    setLoading(true);
    try {
      const result = await fetchAuditItems({ ...filters, page: nextPage });
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审计日志加载失败');
      toast({ title: '审计日志加载失败', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAuditItems()
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
      })
      .catch(() => setError('审计日志加载失败'))
      .finally(() => setLoading(false));
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load(1, { search, resourceType });
  }

  const columns: DataTableColumn<AuditItem>[] = [
    {
      key: 'action',
      header: '事件',
      cell: (item) => (
        <div className="table-primary">
          <strong>{actionLabel(item.action)}</strong>
          <small>{item.action}</small>
        </div>
      ),
    },
    {
      key: 'resource',
      header: '资源',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.resourceType}</strong>
          <small>{item.resourceId ?? '无资源 ID'}</small>
        </div>
      ),
    },
    {
      key: 'actor',
      header: '操作者',
      cell: (item) =>
        item.actor ? (
          <div className="table-primary">
            <strong>{item.actor.displayName}</strong>
            <small>{item.actor.email}</small>
          </div>
        ) : (
          <StatusPill tone="neutral">系统</StatusPill>
        ),
    },
    {
      key: 'time',
      header: '时间',
      cell: (item) => new Date(item.createdAt).toLocaleString('zh-CN'),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (item) => (
        <Button onClick={() => setSelected(item)} size="sm" variant="ghost">
          详情
        </Button>
      ),
    },
  ];

  return (
    <PageFrame section={sections.audit}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>审计事件</span>
          <strong>{total}</strong>
          <small>按发生时间倒序保留</small>
        </article>
        <article className="metric-card">
          <span>当前页</span>
          <strong>{items.length}</strong>
          <small>默认加载最近 30 条</small>
        </article>
        <article className="metric-card">
          <span>数据内容</span>
          <strong>Metadata</strong>
          <small>禁止写入密钥和密码</small>
        </article>
        <article className="metric-card">
          <span>访问控制</span>
          <strong>audit.read</strong>
          <small>独立审计权限</small>
        </article>
      </div>
      {error ? <p className="integration-notice error">{error}</p> : null}
      <ResourceSection
        title="操作记录"
        description="统一追踪身份、设置、集成、任务、通知和资产等基础能力的关键变更。"
      >
        <FilterBar
          actions={
            <Button size="sm" type="submit">
              查询
            </Button>
          }
          onReset={() => {
            setSearch('');
            setResourceType('');
            void load(1);
          }}
          onSubmit={submit}
        >
          <Input
            aria-label="搜索审计记录"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索动作、资源或 Request ID"
            value={search}
          />
          <Input
            aria-label="资源类型"
            onChange={(event) => setResourceType(event.target.value)}
            placeholder="资源类型，如 account"
            value={resourceType}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          emptyTitle="暂无审计记录"
          getRowKey={(item) => item.id}
          loading={loading}
          rows={items}
        />
        <AdminPagination
          onPageChange={(nextPage) => void load(nextPage, { search, resourceType })}
          page={page}
          pageSize={30}
          total={total}
        />
      </ResourceSection>
      <DetailDrawer
        description={selected?.action}
        onOpenChange={(open) => !open && setSelected(null)}
        open={Boolean(selected)}
        title={selected ? actionLabel(selected.action) : '审计详情'}
      >
        {selected ? (
          <dl className="audit-detail">
            <div>
              <dt>事件 ID</dt>
              <dd>
                <code>{selected.id}</code>
              </dd>
            </div>
            <div>
              <dt>资源</dt>
              <dd>
                {selected.resourceType} · {selected.resourceId ?? '—'}
              </dd>
            </div>
            <div>
              <dt>Request ID</dt>
              <dd>
                <code>{selected.requestId ?? '—'}</code>
              </dd>
            </div>
            <div>
              <dt>操作者</dt>
              <dd>
                {selected.actor
                  ? `${selected.actor.displayName} · ${selected.actor.email}`
                  : (selected.actorId ?? '系统')}
              </dd>
            </div>
            <div>
              <dt>发生时间</dt>
              <dd>{new Date(selected.createdAt).toLocaleString('zh-CN')}</dd>
            </div>
            <div>
              <dt>元数据</dt>
              <dd>
                <pre>{JSON.stringify(selected.metadata ?? {}, null, 2)}</pre>
              </dd>
            </div>
          </dl>
        ) : null}
      </DetailDrawer>
    </PageFrame>
  );
}
