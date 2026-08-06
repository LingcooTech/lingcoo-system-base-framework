import { Button } from '@lingcoo/frame-ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcoo/frame-ui/dialog';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { Textarea } from '@lingcoo/frame-ui/textarea';
import { useEffect, useState, type FormEvent } from 'react';

import {
  archiveNotification,
  fetchAdminNotifications,
  fetchIntegrationConnections,
  fetchMyNotifications,
  fetchNotificationDeliveries,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  publishAnnouncement,
  type IntegrationConnection,
  type NotificationItem,
  type NotificationDelivery,
} from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';

export function NotificationsPage() {
  const { hasPermission } = useAuth();
  const [mine, setMine] = useState<NotificationItem[]>([]);
  const [adminItems, setAdminItems] = useState<NotificationItem[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [smtpConnections, setSmtpConnections] = useState<IntegrationConnection[]>([]);
  const [unread, setUnread] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [level, setLevel] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [sendEmail, setSendEmail] = useState(false);
  const [smtpConnectionId, setSmtpConnectionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [myResult, count, connections, adminResult, deliveryResult] = await Promise.all([
        fetchMyNotifications(),
        fetchUnreadNotificationCount(),
        fetchIntegrationConnections(),
        hasPermission('notifications.read')
          ? fetchAdminNotifications()
          : Promise.resolve({ items: [], total: 0 }),
        hasPermission('notifications.read')
          ? fetchNotificationDeliveries()
          : Promise.resolve({ items: [], total: 0 }),
      ]);
      setMine(myResult.items);
      setUnread(count);
      setAdminItems(adminResult.items);
      setDeliveries(deliveryResult.items);
      const smtp = connections.filter((item) => item.providerCode === 'smtp' && item.enabled);
      setSmtpConnections(smtp);
      setSmtpConnectionId((current) => current || smtp[0]?.id || '');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通知加载失败');
    }
  }

  useEffect(() => {
    Promise.all([
      fetchMyNotifications(),
      fetchUnreadNotificationCount(),
      fetchIntegrationConnections(),
      hasPermission('notifications.read')
        ? fetchAdminNotifications()
        : Promise.resolve({ items: [], total: 0 }),
      hasPermission('notifications.read')
        ? fetchNotificationDeliveries()
        : Promise.resolve({ items: [], total: 0 }),
    ])
      .then(([myResult, count, connections, adminResult, deliveryResult]) => {
        setMine(myResult.items);
        setUnread(count);
        setAdminItems(adminResult.items);
        setDeliveries(deliveryResult.items);
        const smtp = connections.filter((item) => item.providerCode === 'smtp' && item.enabled);
        setSmtpConnections(smtp);
        setSmtpConnectionId((current) => current || smtp[0]?.id || '');
        setError('');
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : '通知加载失败');
      });
  }, [hasPermission]);

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通知更新失败');
    }
  }

  async function submitAnnouncement(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await publishAnnouncement({
        title,
        body,
        level,
        sendEmail,
        ...(sendEmail && smtpConnectionId ? { smtpConnectionId } : {}),
      });
      setMessage(
        `公告已发布给 ${result.recipientCount} 个账号${sendEmail ? '，邮件已进入任务队列' : ''}。`,
      );
      setDialogOpen(false);
      setTitle('');
      setBody('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '公告发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateMine(item: NotificationItem, action: 'read' | 'archive') {
    try {
      if (action === 'read') await markNotificationRead(item.id);
      else await archiveNotification(item.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通知更新失败');
    }
  }

  const mineColumns: DataTableColumn<NotificationItem>[] = [
    {
      key: 'notification',
      header: '通知',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.title}</strong>
          <small>{item.body}</small>
        </div>
      ),
    },
    { key: 'category', header: '分类', cell: (item) => item.category },
    {
      key: 'status',
      header: '状态',
      cell: (item) => (
        <StatusPill tone={item.status === 'unread' ? 'info' : 'neutral'}>
          {item.status === 'unread' ? '未读' : item.status === 'read' ? '已读' : '已归档'}
        </StatusPill>
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
        <div className="integration-actions">
          {item.status === 'unread' ? (
            <Button onClick={() => void updateMine(item, 'read')} size="sm" variant="ghost">
              标为已读
            </Button>
          ) : null}
          {item.status !== 'archived' ? (
            <Button onClick={() => void updateMine(item, 'archive')} size="sm" variant="ghost">
              归档
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  const adminColumns: DataTableColumn<NotificationItem>[] = [
    {
      key: 'recipient',
      header: '接收账号',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.recipient?.displayName}</strong>
          <small>{item.recipient?.email}</small>
        </div>
      ),
    },
    {
      key: 'notification',
      header: '通知',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.title}</strong>
          <small>{item.body}</small>
        </div>
      ),
    },
    { key: 'category', header: '分类', cell: (item) => item.category },
    { key: 'status', header: '状态', cell: (item) => item.status },
    {
      key: 'time',
      header: '时间',
      align: 'right',
      cell: (item) => new Date(item.createdAt).toLocaleString('zh-CN'),
    },
  ];
  const deliveryColumns: DataTableColumn<NotificationDelivery>[] = [
    {
      key: 'notification',
      header: '通知',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.notificationTitle}</strong>
          <small>{item.destination}</small>
        </div>
      ),
    },
    { key: 'connection', header: '通道', cell: (item) => item.connectionName || item.channel },
    {
      key: 'status',
      header: '投递状态',
      cell: (item) => (
        <StatusPill
          tone={
            item.status === 'sent'
              ? 'ok'
              : item.status === 'failed'
                ? 'danger'
                : item.status === 'sending'
                  ? 'info'
                  : 'neutral'
          }
        >
          {item.status === 'sent'
            ? '已发送'
            : item.status === 'failed'
              ? '失败'
              : item.status === 'sending'
                ? '发送中'
                : '等待中'}
        </StatusPill>
      ),
    },
    { key: 'attempts', header: '尝试', cell: (item) => item.attempts },
    {
      key: 'time',
      header: '创建时间',
      align: 'right',
      cell: (item) => new Date(item.createdAt).toLocaleString('zh-CN'),
    },
  ];

  return (
    <PageFrame section={sections.notifications}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>我的未读</span>
          <strong>{unread}</strong>
          <small>当前登录账号</small>
        </article>
        <article className="metric-card">
          <span>我的通知</span>
          <strong>{mine.length}</strong>
          <small>最近 30 条</small>
        </article>
        <article className="metric-card">
          <span>通知记录</span>
          <strong>{adminItems.length}</strong>
          <small>最近 50 条管理视图</small>
        </article>
        <article className="metric-card">
          <span>邮件通道</span>
          <strong>{smtpConnections.length}</strong>
          <small>已启用 SMTP 连接</small>
        </article>
      </div>
      {message ? <p className="integration-notice success">{message}</p> : null}
      {error ? <p className="integration-notice error">{error}</p> : null}
      <ResourceSection title="我的通知" description="所有账号都有独立的未读、已读与归档状态。">
        <div className="integration-toolbar">
          <p>站内通知不依赖外部服务。</p>
          <Button
            disabled={unread === 0}
            onClick={() => void markAllRead()}
            size="sm"
            variant="secondary"
          >
            全部已读
          </Button>
        </div>
        <DataTable
          columns={mineColumns}
          emptyTitle="暂无通知"
          getRowKey={(item) => item.id}
          rows={mine}
        />
      </ResourceSection>
      {hasPermission('notifications.read') ? (
        <>
          <ResourceSection
            title="全局通知记录"
            description="管理员可查看通知生成结果；邮件执行情况同步进入任务中心。"
          >
            <div className="integration-toolbar">
              <p>公告按账号生成幂等通知，可选异步邮件。</p>
              {hasPermission('notifications.manage') ? (
                <Button onClick={() => setDialogOpen(true)} size="sm">
                  发布公告
                </Button>
              ) : null}
            </div>
            <DataTable
              columns={adminColumns}
              emptyTitle="暂无全局通知"
              getRowKey={(item) => item.id}
              rows={adminItems}
            />
          </ResourceSection>
          <ResourceSection
            title="邮件投递"
            description="每次发送均关联 SMTP 连接与后台任务，失败后可在任务中心重试。"
          >
            <DataTable
              columns={deliveryColumns}
              emptyTitle="暂无邮件投递"
              getRowKey={(item) => item.id}
              rows={deliveries}
            />
          </ResourceSection>
        </>
      ) : null}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          header={
            <DialogHeader
              title="发布系统公告"
              description="为所有启用账号创建站内通知；邮件发送通过 Worker 异步执行。"
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} variant="secondary">
                取消
              </Button>
              <Button
                disabled={sendEmail && smtpConnections.length === 0}
                form="announcement-form"
                loading={submitting}
                type="submit"
              >
                确认发布
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="announcement-form" onSubmit={submitAnnouncement}>
            <FormField label="标题" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  maxLength={160}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  value={title}
                />
              )}
            </FormField>
            <FormField label="正文" required>
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  maxLength={5000}
                  onChange={(event) => setBody(event.target.value)}
                  required
                  rows={7}
                  value={body}
                />
              )}
            </FormField>
            <FormField label="级别" required>
              {({ controlId }) => (
                <select
                  className="integration-select"
                  id={controlId}
                  onChange={(event) => setLevel(event.target.value as typeof level)}
                  value={level}
                >
                  <option value="info">信息</option>
                  <option value="success">成功</option>
                  <option value="warning">提醒</option>
                  <option value="error">重要</option>
                </select>
              )}
            </FormField>
            <label className="integration-check">
              <input
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                type="checkbox"
              />
              <span>
                <strong>同时发送邮件</strong>
                <small>每个接收账号创建一个可重试任务。</small>
              </span>
            </label>
            {sendEmail ? (
              <FormField label="SMTP 连接" required>
                {({ controlId }) => (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setSmtpConnectionId(event.target.value)}
                    required
                    value={smtpConnectionId}
                  >
                    {smtpConnections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}
            {sendEmail && smtpConnections.length === 0 ? (
              <p className="auth-error">请先配置、测试并启用 SMTP 连接。</p>
            ) : null}
          </form>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
