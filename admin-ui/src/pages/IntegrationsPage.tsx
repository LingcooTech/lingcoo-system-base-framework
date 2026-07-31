import { Button } from '@lingcoo/frame-ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcoo/frame-ui/dialog';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { CheckCircle2, PlugZap } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  createIntegrationConnection,
  fetchIntegrationConnections,
  fetchIntegrationProviders,
  testIntegrationConnection,
  updateIntegrationConnection,
  type IntegrationConnection,
  type IntegrationField,
  type IntegrationProvider,
} from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

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

function DynamicField({
  field,
  values,
  setValues,
}: {
  field: IntegrationField;
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
  return (
    <FormField label={field.label} description={field.description} required={field.required}>
      {({ controlId }) => (
        <Input
          id={controlId}
          onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
          placeholder={field.placeholder}
          required={field.required}
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
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [providerCode, setProviderCode] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string | boolean>>({});
  const [credentialValues, setCredentialValues] = useState<Record<string, string | boolean>>({});
  const [busyId, setBusyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const availableProviders = useMemo(
    () => providers.filter((provider) => provider.availability === 'available'),
    [providers],
  );
  const selectedProvider = providers.find((provider) => provider.code === providerCode);

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
      await createIntegrationConnection({
        providerCode: selectedProvider.code,
        name: connectionName,
        config,
        credentials,
      });
      setDialogOpen(false);
      setConnectionName('');
      setConfigValues({});
      setCredentialValues({});
      setMessage('连接已保存。完成连通性测试后即可启用。');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存连接失败');
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
        description="底座只声明公共能力；具体适配器安装后才允许录入服务配置。"
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
          <Button
            disabled={availableProviders.length === 0}
            onClick={() => setDialogOpen(true)}
            size="sm"
          >
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
              title="新建服务连接"
              description="普通配置可见，访问凭据将立即加密且不再回传。"
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
                  id={controlId}
                  onChange={(event) => {
                    setProviderCode(event.target.value);
                    setConfigValues({});
                    setCredentialValues({});
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
                setValues={setCredentialValues}
                values={credentialValues}
              />
            ))}
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
