import { Button } from '@lingcoo/frame-ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcoo/frame-ui/dialog';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { Textarea } from '@lingcoo/frame-ui/textarea';
import { useEffect, useState, type FormEvent } from 'react';

import {
  fetchSystemSettingHistory,
  fetchSystemSettings,
  updateSystemSetting,
  type SystemSetting,
  type SystemSettingVersion,
} from '../api/client';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<SystemSetting[]>([]);
  const [editing, setEditing] = useState<SystemSetting | null>(null);
  const [historyFor, setHistoryFor] = useState<SystemSetting | null>(null);
  const [history, setHistory] = useState<SystemSettingVersion[]>([]);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await fetchSystemSettings());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '系统设置加载失败');
    }
  }

  useEffect(() => {
    fetchSystemSettings()
      .then(setItems)
      .catch(() => setError('系统设置加载失败'));
  }, []);

  function openEditor(item: SystemSetting) {
    setEditing(item);
    setValue(item.value);
    setReason('');
    setError('');
  }

  async function openHistory(item: SystemSetting) {
    setHistoryFor(item);
    setHistory([]);
    try {
      setHistory(await fetchSystemSettingHistory(item.key));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '变更历史加载失败');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    setError('');
    try {
      await updateSystemSetting(editing.key, value, reason);
      setEditing(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '设置保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <PageFrame section={sections.settings}>
      {error ? <p className="integration-notice error">{error}</p> : null}
      <ResourceSection
        title="配置边界"
        description="这里只管理非敏感、可在线变更的系统参数；数据库、认证密钥和 Provider 凭据仍由环境变量或加密连接管理。"
      >
        <dl className="settings-list">
          <div>
            <dt>部署参数</dt>
            <dd>
              <StatusPill tone="info">环境变量</StatusPill>
            </dd>
          </div>
          <div>
            <dt>Provider 凭据</dt>
            <dd>
              <StatusPill tone="ok">加密隔离</StatusPill>
            </dd>
          </div>
          <div>
            <dt>在线设置</dt>
            <dd>
              <StatusPill tone="ok">类型校验</StatusPill>
            </dd>
          </div>
          <div>
            <dt>每次变更</dt>
            <dd>
              <StatusPill tone="ok">留存版本</StatusPill>
            </dd>
          </div>
        </dl>
      </ResourceSection>
      {groups.map((group) => {
        const settings = items.filter((item) => item.group === group);
        return (
          <ResourceSection
            description="设置值由框架提供默认值，行业系统只需覆盖确有差异的部分。"
            key={group}
            title={settings[0]?.groupLabel ?? group}
          >
            <div className="setting-cards">
              {settings.map((item) => (
                <article className="setting-card" key={item.key}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                    <code>{item.key}</code>
                  </div>
                  <div className="setting-value">
                    <span>{item.value || '未设置'}</span>
                    <small>{item.isDefault ? '框架默认值' : `版本 ${item.version}`}</small>
                  </div>
                  <div className="integration-actions">
                    {!item.isDefault ? (
                      <Button onClick={() => void openHistory(item)} size="sm" variant="ghost">
                        历史
                      </Button>
                    ) : null}
                    {hasPermission('system.settings.write') ? (
                      <Button onClick={() => openEditor(item)} size="sm" variant="secondary">
                        编辑
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </ResourceSection>
        );
      })}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          header={
            <DialogHeader
              title={`编辑${editing?.label ?? '设置'}`}
              description={editing?.description}
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setEditing(null)} variant="secondary">
                取消
              </Button>
              <Button form="setting-edit-form" loading={submitting} type="submit">
                保存设置
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="setting-edit-form" onSubmit={submit}>
            <FormField label="设置值" required>
              {({ controlId }) =>
                editing?.type === 'select' ? (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setValue(event.target.value)}
                    value={value}
                  >
                    {editing.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={controlId}
                    onChange={(event) => setValue(event.target.value)}
                    required={editing?.key === 'general.system_name'}
                    type={
                      editing?.type === 'email' ? 'email' : editing?.type === 'url' ? 'url' : 'text'
                    }
                    value={value}
                  />
                )
              }
            </FormField>
            <FormField description="可选，用于让后续维护者理解本次调整。" label="变更原因">
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  value={reason}
                />
              )}
            </FormField>
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(historyFor)} onOpenChange={(open) => !open && setHistoryFor(null)}>
        <DialogContent
          header={
            <DialogHeader
              title={`${historyFor?.label ?? ''} · 变更历史`}
              description="历史版本只读保存，不包含任何 Provider 密钥。"
            />
          }
        >
          <div className="setting-history">
            {history.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>版本 {item.version}</strong>
                  <small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small>
                </div>
                <code>{item.value || '空值'}</code>
                <p>
                  {item.changeReason || '未填写变更原因'} · {item.actor?.displayName ?? '系统账号'}
                </p>
              </article>
            ))}
            {history.length === 0 ? <p className="section-message">暂无显式变更记录。</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
