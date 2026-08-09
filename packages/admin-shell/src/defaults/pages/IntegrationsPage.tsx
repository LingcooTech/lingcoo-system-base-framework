import { Button } from '@lingcootech/frame-ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcootech/frame-ui/dialog';
import { FormField } from '@lingcootech/frame-ui/form-field';
import { Input } from '@lingcootech/frame-ui/input';
import { Textarea } from '@lingcootech/frame-ui/textarea';
import { CheckCircle2, PlugZap } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  createIntegrationConnection,
  fetchQiniuObjects,
  fetchIntegrationEvents,
  fetchIntegrationConnections,
  fetchIntegrationProviders,
  sendSmtpTestEmail,
  sendOpenRouterTest,
  testIntegrationConnection,
  updateIntegrationConnection,
  type IntegrationConnection,
  type IntegrationField,
  type IntegrationEvent,
  type IntegrationProvider,
  type QiniuObjectItem,
} from '../client.js';
import { useAdminAuth as useAuth } from '../../auth.js';
import {
  DataTable,
  PageFrame,
  ResourceSection,
  StatusPill,
  type DataTableColumn,
} from '../../shared.js';
import { sections } from '../foundation.js';

const categoryNames: Record<IntegrationProvider['category'], string> = {
  communication: '通信',
  storage: '存储',
  payment: '支付',
  ai: 'AI',
  developer: '开发工具',
};

function fieldValue(field: IntegrationField, values: Record<string, string | boolean>): unknown {
  const value = values[field.key];
  if (field.type === 'number')
    return value === '' || value === undefined ? undefined : Number(value);
  return value;
}

function defaultFieldValues(fields: IntegrationField[]): Record<string, string | boolean> {
  return Object.fromEntries(
    fields
      .filter((field) => field.defaultValue !== undefined)
      .map((field) => [
        field.key,
        typeof field.defaultValue === 'boolean' ? field.defaultValue : String(field.defaultValue),
      ]),
  );
}

function configuredFieldValues(
  fields: IntegrationField[],
  config: Record<string, unknown>,
): Record<string, string | boolean> {
  return Object.fromEntries(
    fields.map((field) => {
      const value =
        config[field.key] ?? field.defaultValue ?? (field.type === 'boolean' ? false : '');
      return [field.key, typeof value === 'boolean' ? value : String(value)];
    }),
  );
}

function DynamicField({
  field,
  required = field.required,
  values,
  setValues,
}: {
  field: IntegrationField;
  required?: boolean;
  values: Record<string, string | boolean>;
  setValues(values: Record<string, string | boolean>): void;
}) {
  if (field.type === 'boolean') {
    return (
      <label className="integration-check">
        <input
          checked={Boolean(values[field.key])}
          onChange={(event) => setValues({ ...values, [field.key]: event.target.checked })}
          type="checkbox"
        />
        <span>
          <strong>{field.label}</strong>
          {field.description ? <small>{field.description}</small> : null}
        </span>
      </label>
    );
  }
  if (field.type === 'textarea' || field.type === 'secret-textarea') {
    return (
      <FormField label={field.label} description={field.description} required={required}>
        {({ controlId }) => (
          <Textarea
            className={field.type === 'secret-textarea' ? 'integration-secret-textarea' : undefined}
            id={controlId}
            onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
            placeholder={field.placeholder}
            required={required}
            rows={6}
            value={String(values[field.key] ?? '')}
          />
        )}
      </FormField>
    );
  }
  return (
    <FormField label={field.label} description={field.description} required={required}>
      {({ controlId }) => (
        <Input
          id={controlId}
          onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
          placeholder={field.placeholder}
          required={required}
          type={
            field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'
          }
          value={String(values[field.key] ?? '')}
        />
      )}
    </FormField>
  );
}

export function IntegrationsPage() {
  const { account } = useAuth();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<IntegrationConnection | null>(null);
  const [mailConnection, setMailConnection] = useState<IntegrationConnection | null>(null);
  const [storageConnection, setStorageConnection] = useState<IntegrationConnection | null>(null);
  const [storageObjects, setStorageObjects] = useState<QiniuObjectItem[]>([]);
  const [aiConnection, setAiConnection] = useState<IntegrationConnection | null>(null);
  const [aiPrompt, setAiPrompt] = useState('请用一句话说明当前 AI 连接已经正常工作。');
  const [aiResult, setAiResult] = useState('');
  const [eventConnection, setEventConnection] = useState<IntegrationConnection | null>(null);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [providerCode, setProviderCode] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string | boolean>>({});
  const [credentialValues, setCredentialValues] = useState<Record<string, string | boolean>>({});
  const [busyId, setBusyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('Lingcoo Frame SMTP 测试邮件');
  const [testText, setTestText] = useState(
    '如果你收到了这封邮件，说明当前 SMTP 连接已经可以正常发送邮件。',
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const availableProviders = useMemo(
    () => providers.filter((provider) => provider.availability === 'available'),
    [providers],
  );
  const selectedProvider = providers.find((provider) => provider.code === providerCode);

  function openCreateDialog() {
    const provider = availableProviders[0];
    if (!provider) return;
    setEditingConnection(null);
    setProviderCode(provider.code);
    setConnectionName('');
    setConfigValues(defaultFieldValues(provider.configFields));
    setCredentialValues(defaultFieldValues(provider.credentialFields));
    setError('');
    setDialogOpen(true);
  }

  function openEditDialog(connection: IntegrationConnection) {
    const provider = providers.find((item) => item.code === connection.providerCode);
    if (!provider) return;
    setEditingConnection(connection);
    setProviderCode(provider.code);
    setConnectionName(connection.name);
    setConfigValues(configuredFieldValues(provider.configFields, connection.config));
    setCredentialValues({});
    setError('');
    setDialogOpen(true);
  }

  function openMailDialog(connection: IntegrationConnection) {
    setMailConnection(connection);
    setTestTo(account?.email ?? '');
    setTestSubject('Lingcoo Frame SMTP 测试邮件');
    setTestText('如果你收到了这封邮件，说明当前 SMTP 连接已经可以正常发送邮件。');
    setError('');
  }

  async function openEventsDialog(connection: IntegrationConnection) {
    setEventConnection(connection);
    setEvents([]);
    setError('');
    try {
      setEvents(await fetchIntegrationEvents(connection.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '连接事件加载失败');
    }
  }

  async function openStorageDialog(connection: IntegrationConnection) {
    setStorageConnection(connection);
    setStorageObjects([]);
    setError('');
    try {
      setStorageObjects(await fetchQiniuObjects(connection.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '对象列表加载失败');
    }
  }

  function openAiDialog(connection: IntegrationConnection) {
    setAiConnection(connection);
    setAiPrompt('请用一句话说明当前 AI 连接已经正常工作。');
    setAiResult('');
    setError('');
  }

  async function load() {
    try {
      const [providerItems, connectionItems] = await Promise.all([
        fetchIntegrationProviders(),
        fetchIntegrationConnections(),
      ]);
      setProviders(providerItems);
      setConnections(connectionItems);
      setProviderCode(
        (current) =>
          current || providerItems.find((item) => item.availability === 'available')?.code || '',
      );
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    Promise.all([fetchIntegrationProviders(), fetchIntegrationConnections()])
      .then(([providerItems, connectionItems]) => {
        setProviders(providerItems);
        setConnections(connectionItems);
        setProviderCode(
          (current) =>
            current || providerItems.find((item) => item.availability === 'available')?.code || '',
        );
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  async function submitConnection(event: FormEvent) {
    event.preventDefault();
    if (!selectedProvider) return;
    setSubmitting(true);
    setError('');
    try {
      const config = Object.fromEntries(
        selectedProvider.configFields
          .map((field) => [field.key, fieldValue(field, configValues)])
          .filter(([, value]) => value !== undefined && value !== ''),
      );
      const credentials = Object.fromEntries(
        selectedProvider.credentialFields
          .map((field) => [field.key, fieldValue(field, credentialValues)])
          .filter(([, value]) => value !== undefined && value !== ''),
      );
      if (editingConnection) {
        const configChanged = JSON.stringify(config) !== JSON.stringify(editingConnection.config);
        await updateIntegrationConnection(editingConnection.id, {
          name: connectionName,
          ...(configChanged ? { config } : {}),
          ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
        });
      } else {
        await createIntegrationConnection({
          providerCode: selectedProvider.code,
          name: connectionName,
          config,
          credentials,
        });
      }
      setDialogOpen(false);
      setEditingConnection(null);
      setConnectionName('');
      setConfigValues({});
      setCredentialValues({});
      setMessage(
        editingConnection
          ? '连接已更新；如果配置发生变化，请重新完成连通性测试。'
          : '连接已保存。完成连通性测试后即可启用。',
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存连接失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTestEmail(event: FormEvent) {
    event.preventDefault();
    if (!mailConnection) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await sendSmtpTestEmail(mailConnection.id, {
        to: testTo,
        subject: testSubject,
        text: testText,
      });
      setMailConnection(null);
      setMessage(`测试邮件已提交：${result.from} → ${result.to}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '测试邮件发送失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAiTest(event: FormEvent) {
    event.preventDefault();
    if (!aiConnection) return;
    setSubmitting(true);
    setError('');
    setAiResult('');
    try {
      const result = await sendOpenRouterTest(aiConnection.id, aiPrompt);
      setAiResult(
        `${result.content}\n\n模型：${result.model}${result.usage ? ` · ${result.usage.totalTokens} tokens` : ''}`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '模型测试失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function testConnection(connection: IntegrationConnection) {
    setBusyId(connection.id);
    setError('');
    setMessage('');
    try {
      const result = await testIntegrationConnection(connection.id);
      setMessage(
        result.ok ? `连通性测试通过：${result.message}` : `连通性测试失败：${result.message}`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '连通性测试失败');
    } finally {
      setBusyId('');
    }
  }

  async function toggleConnection(connection: IntegrationConnection) {
    setBusyId(connection.id);
    setError('');
    setMessage('');
    try {
      await updateIntegrationConnection(connection.id, { enabled: !connection.enabled });
      setMessage(connection.enabled ? '连接已停用。' : '连接已启用。');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新连接失败');
    } finally {
      setBusyId('');
    }
  }

  const columns: DataTableColumn<IntegrationConnection>[] = [
    {
      key: 'connection',
      header: '连接',
      cell: (connection) => (
        <div className="table-primary">
          <strong>{connection.name}</strong>
          <small>{connection.providerCode}</small>
        </div>
      ),
    },
    {
      key: 'credentials',
      header: '凭据',
      cell: (connection) =>
        connection.credentialKeys.length > 0
          ? `${connection.credentialKeys.length} 项 · 已加密`
          : '无凭据',
    },
    {
      key: 'test',
      header: '最近测试',
      cell: (connection) =>
        connection.lastTestStatus ? (
          <div className="table-primary">
            <StatusPill tone={connection.lastTestStatus === 'success' ? 'ok' : 'danger'}>
              {connection.lastTestStatus === 'success' ? '通过' : '失败'}
            </StatusPill>
            <small>{connection.lastTestMessage}</small>
          </div>
        ) : (
          <StatusPill tone="neutral">未测试</StatusPill>
        ),
    },
    {
      key: 'status',
      header: '状态',
      cell: (connection) => (
        <StatusPill tone={connection.enabled ? 'ok' : 'neutral'}>
          {connection.enabled ? '已启用' : '未启用'}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (connection) => (
        <div className="integration-actions">
          <Button onClick={() => openEditDialog(connection)} size="sm" variant="ghost">
            编辑
          </Button>
          <Button onClick={() => void openEventsDialog(connection)} size="sm" variant="ghost">
            事件
          </Button>
          <Button
            loading={busyId === connection.id}
            onClick={() => void testConnection(connection)}
            size="sm"
            variant="secondary"
          >
            测试
          </Button>
          <Button
            disabled={!connection.enabled && connection.lastTestStatus !== 'success'}
            onClick={() => void toggleConnection(connection)}
            size="sm"
            variant="ghost"
          >
            {connection.enabled ? '停用' : '启用'}
          </Button>
          {connection.providerCode === 'smtp' ? (
            <Button
              disabled={!connection.enabled}
              onClick={() => openMailDialog(connection)}
              size="sm"
              variant="secondary"
            >
              发测试邮件
            </Button>
          ) : null}
          {connection.providerCode === 'qiniu' ? (
            <Button
              disabled={!connection.enabled}
              onClick={() => void openStorageDialog(connection)}
              size="sm"
              variant="secondary"
            >
              浏览对象
            </Button>
          ) : null}
          {connection.providerCode === 'openrouter' ? (
            <Button
              disabled={!connection.enabled}
              onClick={() => openAiDialog(connection)}
              size="sm"
              variant="secondary"
            >
              模型测试
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageFrame section={sections.integrations}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>Provider 目录</span>
          <strong>{status === 'ready' ? providers.length : '—'}</strong>
          <small>能力契约统一登记</small>
        </article>
        <article className="metric-card">
          <span>已安装适配器</span>
          <strong>{status === 'ready' ? availableProviders.length : '—'}</strong>
          <small>可创建服务连接</small>
        </article>
        <article className="metric-card">
          <span>服务连接</span>
          <strong>{status === 'ready' ? connections.length : '—'}</strong>
          <small>配置与凭据分离</small>
        </article>
        <article className="metric-card">
          <span>安全封装</span>
          <strong>AES</strong>
          <small>256-GCM · 不回传明文</small>
        </article>
      </div>

      {message ? <p className="integration-notice success">{message}</p> : null}
      {error ? <p className="integration-notice error">{error}</p> : null}

      <ResourceSection
        title="Provider 目录"
        description="已安装适配器可以创建真实连接；等待适配器的能力暂时只展示契约。"
      >
        <div className="integration-catalog">
          {providers.map((provider) => (
            <article key={provider.code}>
              <div className="provider-icon">
                {provider.availability === 'available' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <PlugZap size={18} />
                )}
              </div>
              <div>
                <span>{categoryNames[provider.category]}</span>
                <h3>{provider.name}</h3>
                <p>{provider.description}</p>
              </div>
              <StatusPill tone={provider.availability === 'available' ? 'ok' : 'neutral'}>
                {provider.availability === 'available' ? '适配器已安装' : '等待适配器'}
              </StatusPill>
            </article>
          ))}
        </div>
      </ResourceSection>

      <ResourceSection
        title="服务连接"
        description="密钥永不返回前端；配置变更会自动停用连接并要求重新测试。"
      >
        <div className="integration-toolbar">
          <p>只有通过当前配置连通性测试的连接才能启用。</p>
          <Button disabled={availableProviders.length === 0} onClick={openCreateDialog} size="sm">
            新建连接
          </Button>
        </div>
        <DataTable
          columns={columns}
          emptyTitle={
            availableProviders.length === 0 ? '安装 Provider 适配器后即可创建连接' : '暂无服务连接'
          }
          getRowKey={(connection) => connection.id}
          rows={connections}
        />
      </ResourceSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          header={
            <DialogHeader
              title={editingConnection ? '编辑服务连接' : '新建服务连接'}
              description={
                editingConnection
                  ? '已保存的凭据不会回传；密码留空表示保持原值。'
                  : '普通配置可见，访问凭据将立即加密且不再回传。'
              }
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} variant="secondary">
                取消
              </Button>
              <Button form="integration-create-form" loading={submitting} type="submit">
                保存连接
              </Button>
            </DialogFooter>
          }
        >
          <form
            className="integration-form"
            id="integration-create-form"
            onSubmit={submitConnection}
          >
            <FormField label="Provider" required>
              {({ controlId }) => (
                <select
                  className="integration-select"
                  disabled={Boolean(editingConnection)}
                  id={controlId}
                  onChange={(event) => {
                    const provider = providers.find((item) => item.code === event.target.value);
                    setProviderCode(event.target.value);
                    setConfigValues(defaultFieldValues(provider?.configFields ?? []));
                    setCredentialValues(defaultFieldValues(provider?.credentialFields ?? []));
                  }}
                  value={providerCode}
                >
                  {availableProviders.map((provider) => (
                    <option key={provider.code} value={provider.code}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="连接名称" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setConnectionName(event.target.value)}
                  placeholder="例如：生产环境邮件通道"
                  required
                  value={connectionName}
                />
              )}
            </FormField>
            {selectedProvider?.configFields.map((field) => (
              <DynamicField
                field={field}
                key={`config-${field.key}`}
                setValues={setConfigValues}
                values={configValues}
              />
            ))}
            {selectedProvider?.credentialFields.length ? (
              <p className="integration-form-divider">访问凭据</p>
            ) : null}
            {selectedProvider?.credentialFields.map((field) => (
              <DynamicField
                field={field}
                key={`credential-${field.key}`}
                required={
                  Boolean(field.required) &&
                  !(editingConnection?.credentialKeys.includes(field.key) ?? false)
                }
                setValues={setCredentialValues}
                values={credentialValues}
              />
            ))}
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(mailConnection)}
        onOpenChange={(open) => !open && setMailConnection(null)}
      >
        <DialogContent
          header={
            <DialogHeader
              title="发送 SMTP 测试邮件"
              description={`使用 ${mailConnection?.name ?? '当前连接'} 执行一次真实发送。`}
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setMailConnection(null)} variant="secondary">
                取消
              </Button>
              <Button form="smtp-test-form" loading={submitting} type="submit">
                发送测试邮件
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="smtp-test-form" onSubmit={submitTestEmail}>
            <FormField label="收件人" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setTestTo(event.target.value)}
                  required
                  type="email"
                  value={testTo}
                />
              )}
            </FormField>
            <FormField label="主题" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  maxLength={200}
                  onChange={(event) => setTestSubject(event.target.value)}
                  required
                  value={testSubject}
                />
              )}
            </FormField>
            <FormField label="正文" required>
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  maxLength={5000}
                  onChange={(event) => setTestText(event.target.value)}
                  required
                  rows={6}
                  value={testText}
                />
              )}
            </FormField>
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(eventConnection)}
        onOpenChange={(open) => !open && setEventConnection(null)}
      >
        <DialogContent
          size="lg"
          header={
            <DialogHeader
              title="连接事件"
              description={`${eventConnection?.name ?? '当前连接'} 最近 50 次测试与调用记录。`}
            />
          }
        >
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="integration-event-list">
            {events.length === 0 && !error ? (
              <p className="section-message">暂无连接事件。</p>
            ) : (
              events.map((event) => (
                <article key={event.id}>
                  <div>
                    <strong>{event.operation}</strong>
                    <small>{new Date(event.createdAt).toLocaleString('zh-CN')}</small>
                  </div>
                  <p>{event.message ?? '无附加信息'}</p>
                  <div>
                    <StatusPill tone={event.outcome === 'success' ? 'ok' : 'danger'}>
                      {event.outcome === 'success' ? '成功' : '失败'}
                    </StatusPill>
                    <small>{event.durationMs === null ? '—' : `${event.durationMs} ms`}</small>
                  </div>
                </article>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(storageConnection)}
        onOpenChange={(open) => !open && setStorageConnection(null)}
      >
        <DialogContent
          size="lg"
          header={
            <DialogHeader
              title="七牛云对象"
              description={`${storageConnection?.name ?? '当前连接'} 默认前缀下最近 50 个对象。上传凭证、删除与签名能力由领域模块调用。`}
            />
          }
        >
          {error ? <p className="auth-error">{error}</p> : null}
          <div className="integration-event-list">
            {storageObjects.length === 0 && !error ? (
              <p className="section-message">当前前缀下暂无对象。</p>
            ) : (
              storageObjects.map((object) => (
                <article key={object.key}>
                  <div>
                    <strong>{object.key}</strong>
                    <small>{object.mimeType}</small>
                  </div>
                  <p>{(object.size / 1024).toFixed(1)} KB</p>
                  <small>{object.hash || '—'}</small>
                </article>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(aiConnection)} onOpenChange={(open) => !open && setAiConnection(null)}>
        <DialogContent
          header={
            <DialogHeader
              title="OpenRouter 模型测试"
              description={`使用 ${aiConnection?.name ?? '当前连接'} 的默认模型发起一次真实调用，可能产生少量模型费用。`}
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setAiConnection(null)} variant="secondary">
                关闭
              </Button>
              <Button form="openrouter-test-form" loading={submitting} type="submit">
                发送测试
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="openrouter-test-form" onSubmit={submitAiTest}>
            <FormField label="测试提示词" required>
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  maxLength={20_000}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  required
                  rows={5}
                  value={aiPrompt}
                />
              )}
            </FormField>
            {aiResult ? (
              <FormField label="模型响应">
                {({ controlId }) => <Textarea id={controlId} readOnly rows={8} value={aiResult} />}
              </FormField>
            ) : null}
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
