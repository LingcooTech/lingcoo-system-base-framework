import { Button } from '@lingcoo/frame-ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcoo/frame-ui/dialog';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { Textarea } from '@lingcoo/frame-ui/textarea';
import { useEffect, useState, type FormEvent } from 'react';

import {
  createAccessAccount,
  createAccessRole,
  fetchAccessAccounts,
  fetchAccessPermissions,
  fetchAccessRoles,
  resendAccessAccountInvitation,
  updateAccessAccount,
  updateAccessRole,
  type AccessAccount,
  type AccessPermission,
  type AccessRole,
} from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';

export function AccessPage() {
  const { hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [accountDialog, setAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccessAccount | null>(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<AccessRole | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupMethod, setSetupMethod] = useState<'invitation' | 'temporary_password'>('invitation');
  const [statusValue, setStatusValue] = useState<'active' | 'suspended'>('active');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [accountItems, roleItems, permissionItems] = await Promise.all([
      fetchAccessAccounts(),
      fetchAccessRoles(),
      fetchAccessPermissions(),
    ]);
    setAccounts(accountItems);
    setRoles(roleItems);
    setPermissions(permissionItems);
    setStatus('ready');
    setError('');
  }

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

  function openAccount(account?: AccessAccount) {
    setEditingAccount(account ?? null);
    setDisplayName(account?.displayName ?? '');
    setEmail(account?.email ?? '');
    setPassword('');
    setSetupMethod('invitation');
    setStatusValue(account?.status === 'suspended' ? 'suspended' : 'active');
    setSelectedRoles(
      account?.roles.map((role) => role.code) ??
        [roles.find((role) => role.code === 'viewer')?.code ?? roles[0]?.code].filter(Boolean),
    );
    setError('');
    setAccountDialog(true);
  }

  function openRole(role?: AccessRole) {
    setEditingRole(role ?? null);
    setRoleCode(role?.code ?? '');
    setRoleName(role?.name ?? '');
    setRoleDescription(role?.description ?? '');
    setSelectedPermissions(role?.permissions ?? []);
    setError('');
    setRoleDialog(true);
  }

  function toggle(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function submitAccount(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingAccount)
        await updateAccessAccount(editingAccount.id, {
          displayName,
          status: statusValue,
          roleCodes: selectedRoles,
        });
      else
        await createAccessAccount({
          email,
          displayName,
          setupMethod,
          ...(setupMethod === 'temporary_password' ? { password } : {}),
          roleCodes: selectedRoles,
        });
      setAccountDialog(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '账号保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function resendInvitation(accountId: string) {
    setError('');
    try {
      await resendAccessAccountInvitation(accountId);
      setError('邀请邮件已重新进入异步投递队列。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '邀请邮件发送失败');
    }
  }

  async function submitRole(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingRole)
        await updateAccessRole(editingRole.id, {
          name: roleName,
          description: roleDescription,
          permissions: selectedPermissions,
        });
      else
        await createAccessRole({
          code: roleCode,
          name: roleName,
          description: roleDescription,
          permissions: selectedPermissions,
        });
      setRoleDialog(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '角色保存失败');
    } finally {
      setSubmitting(false);
    }
  }

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
      cell: (account) => (
        <StatusPill tone={account.status === 'active' ? 'ok' : 'danger'}>
          {account.status === 'active' ? '启用' : '停用'}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (account) =>
        hasPermission('iam.accounts.write') ? (
          <div className="table-actions">
            {!account.emailVerifiedAt ? (
              <Button onClick={() => void resendInvitation(account.id)} size="sm" variant="ghost">
                重发邀请
              </Button>
            ) : null}
            <Button onClick={() => openAccount(account)} size="sm" variant="ghost">
              编辑
            </Button>
          </div>
        ) : null,
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
    { key: 'description', header: '用途', cell: (role) => role.description ?? '自定义角色' },
    { key: 'permissions', header: '权限数', cell: (role) => String(role.permissions.length) },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (role) =>
        !role.isSystem && hasPermission('iam.roles.write') ? (
          <Button onClick={() => openRole(role)} size="sm" variant="ghost">
            编辑
          </Button>
        ) : (
          <StatusPill tone="neutral">内置</StatusPill>
        ),
    },
  ];
  const permissionGroups = [
    ...new Set(permissions.map((permission) => permission.code.split('.')[0])),
  ];

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
      {error ? <p className="integration-notice error">{error}</p> : null}
      {status === 'error' ? (
        <ResourceSection title="身份服务">
          <p className="section-message error">身份与权限数据加载失败，请稍后重试。</p>
        </ResourceSection>
      ) : (
        <>
          <ResourceSection
            title="系统账号"
            description="账号是稳定身份主体；首次登录必须修改管理员分配的初始密码。"
          >
            <div className="integration-toolbar">
              <p>账号可拥有多个角色，停用账号会立即阻止新的认证请求。</p>
              {hasPermission('iam.accounts.write') ? (
                <Button onClick={() => openAccount()} size="sm">
                  新建账号
                </Button>
              ) : null}
            </div>
            <DataTable
              columns={accountColumns}
              getRowKey={(account) => account.id}
              rows={accounts}
            />
          </ResourceSection>
          <ResourceSection
            title="角色权限"
            description="内置角色保持通用语义；行业系统通过自定义角色组合基础权限和领域权限。"
          >
            <div className="integration-toolbar">
              <p>内置角色由迁移维护，避免线上权限模型发生不可追踪的漂移。</p>
              {hasPermission('iam.roles.write') ? (
                <Button onClick={() => openRole()} size="sm">
                  新建角色
                </Button>
              ) : null}
            </div>
            <DataTable columns={roleColumns} getRowKey={(role) => role.id} rows={roles} />
          </ResourceSection>
        </>
      )}
      <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
        <DialogContent
          header={
            <DialogHeader
              title={editingAccount ? '编辑账号' : '新建账号'}
              description={
                editingAccount
                  ? '调整显示名称、状态和角色分配。'
                  : '推荐通过安全邮件邀请用户自行设置密码，也可使用临时密码。'
              }
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setAccountDialog(false)} variant="secondary">
                取消
              </Button>
              <Button
                disabled={selectedRoles.length === 0}
                form="account-form"
                loading={submitting}
                type="submit"
              >
                保存账号
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="account-form" onSubmit={submitAccount}>
            <FormField label="显示名称" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  maxLength={120}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  value={displayName}
                />
              )}
            </FormField>
            {!editingAccount ? (
              <>
                <FormField label="邮箱" required>
                  {({ controlId }) => (
                    <Input
                      id={controlId}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      type="email"
                      value={email}
                    />
                  )}
                </FormField>
                <FormField label="账号启用方式" required>
                  {({ controlId }) => (
                    <select
                      className="integration-select"
                      id={controlId}
                      onChange={(event) => setSetupMethod(event.target.value as typeof setupMethod)}
                      value={setupMethod}
                    >
                      <option value="invitation">邮件邀请用户自行设置密码</option>
                      <option value="temporary_password">管理员分配临时密码</option>
                    </select>
                  )}
                </FormField>
                {setupMethod === 'temporary_password' ? (
                  <FormField
                    description="至少 12 位；首次登录后强制修改。"
                    label="初始密码"
                    required
                  >
                    {({ controlId }) => (
                      <Input
                        id={controlId}
                        minLength={12}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        type="password"
                        value={password}
                      />
                    )}
                  </FormField>
                ) : null}
              </>
            ) : (
              <FormField label="状态" required>
                {({ controlId }) => (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setStatusValue(event.target.value as typeof statusValue)}
                    value={statusValue}
                  >
                    <option value="active">启用</option>
                    <option value="suspended">停用</option>
                  </select>
                )}
              </FormField>
            )}
            <fieldset className="permission-fieldset">
              <legend>分配角色</legend>
              {roles.map((role) => (
                <label className="integration-check" key={role.id}>
                  <input
                    checked={selectedRoles.includes(role.code)}
                    onChange={() => toggle(role.code, selectedRoles, setSelectedRoles)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.description ?? role.code}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent
          header={
            <DialogHeader
              title={editingRole ? '编辑自定义角色' : '新建自定义角色'}
              description="权限按资源动作组合；后续领域模块注册的权限也会出现在这里。"
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setRoleDialog(false)} variant="secondary">
                取消
              </Button>
              <Button form="role-form" loading={submitting} type="submit">
                保存角色
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="role-form" onSubmit={submitRole}>
            {!editingRole ? (
              <FormField
                description="小写英文开头，可使用点、短横线或下划线。"
                label="角色代码"
                required
              >
                {({ controlId }) => (
                  <Input
                    id={controlId}
                    onChange={(event) => setRoleCode(event.target.value)}
                    required
                    value={roleCode}
                  />
                )}
              </FormField>
            ) : null}
            <FormField label="角色名称" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setRoleName(event.target.value)}
                  required
                  value={roleName}
                />
              )}
            </FormField>
            <FormField label="用途说明">
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  maxLength={500}
                  onChange={(event) => setRoleDescription(event.target.value)}
                  rows={3}
                  value={roleDescription}
                />
              )}
            </FormField>
            <div className="permission-groups">
              {permissionGroups.map((group) => (
                <fieldset className="permission-fieldset" key={group}>
                  <legend>{group}</legend>
                  {permissions
                    .filter((permission) => permission.code.startsWith(`${group}.`))
                    .map((permission) => (
                      <label className="integration-check" key={permission.code}>
                        <input
                          checked={selectedPermissions.includes(permission.code)}
                          onChange={() =>
                            toggle(permission.code, selectedPermissions, setSelectedPermissions)
                          }
                          type="checkbox"
                        />
                        <span>
                          <strong>{permission.name}</strong>
                          <small>{permission.code}</small>
                        </span>
                      </label>
                    ))}
                </fieldset>
              ))}
            </div>
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
