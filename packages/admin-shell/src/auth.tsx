import { Button } from '@lingcoo/frame-ui/button';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { KeyRound, Layers3, Mail } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

export interface AdminAccountRole {
  code: string;
  name: string;
}

export interface AdminAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  roles: readonly AdminAccountRole[];
  permissions: readonly string[];
}

export interface AdminPasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AdminAuthClient<TAccount extends AdminAccount = AdminAccount> {
  getCurrentAccount(): Promise<TAccount | null>;
  login(email: string, password: string): Promise<TAccount>;
  logout(): Promise<void>;
  changePassword(input: AdminPasswordChange): Promise<void>;
}

export interface AdminAuthContextValue<TAccount extends AdminAccount = AdminAccount> {
  account: TAccount | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(input: AdminPasswordChange): Promise<void>;
  refresh(): Promise<void>;
  hasPermission(permission: string): boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue<AdminAccount> | null>(null);

export function AdminAuthProvider<TAccount extends AdminAccount>({
  children,
  client,
  initialAccount,
}: {
  children: ReactNode;
  client: AdminAuthClient<TAccount>;
  initialAccount?: TAccount | null;
}) {
  const [account, setAccount] = useState<TAccount | null>(initialAccount ?? null);
  const [loading, setLoading] = useState(initialAccount === undefined);

  const refresh = useCallback(async () => {
    setAccount(await client.getCurrentAccount());
  }, [client]);

  useEffect(() => {
    let active = true;
    void client
      .getCurrentAccount()
      .then((currentAccount) => {
        if (active) setAccount(currentAccount);
      })
      .catch(() => {
        if (active) setAccount(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  const value = useMemo<AdminAuthContextValue<TAccount>>(
    () => ({
      account,
      loading,
      async login(email, password) {
        setAccount(await client.login(email, password));
      },
      async logout() {
        try {
          await client.logout();
        } finally {
          setAccount(null);
        }
      },
      async changePassword(input) {
        await client.changePassword(input);
        await refresh();
      },
      refresh,
      hasPermission(permission) {
        return account?.permissions.includes(permission) ?? false;
      },
    }),
    [account, client, loading, refresh],
  );

  return (
    <AdminAuthContext.Provider value={value as AdminAuthContextValue<AdminAccount>}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth<TAccount extends AdminAccount = AdminAccount>() {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return value as AdminAuthContextValue<TAccount>;
}

export interface AdminLoginPageProps {
  brandName?: string;
  brandSubtitle?: string;
  description?: string;
  forgotPasswordHref?: string;
  title?: string;
}

export function AdminLoginPage({
  brandName = 'Lingcoo Frame',
  brandSubtitle = 'Administration',
  description = '使用系统账号进入管理后台。',
  forgotPasswordHref = '/auth/forgot-password',
  title = '登录管理后台',
}: AdminLoginPageProps) {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-auth-screen">
      <section className="admin-auth-panel">
        <div className="admin-auth-brand">
          <span className="admin-brand-mark" aria-hidden>
            <Layers3 size={18} />
          </span>
          <span>
            <strong>{brandName}</strong>
            <small>{brandSubtitle}</small>
          </span>
        </div>
        <div className="admin-auth-heading">
          <p className="admin-eyebrow">Secure console</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <form className="admin-auth-form" onSubmit={submit}>
          <FormField label="邮箱" required>
            {({ controlId }) => (
              <Input
                autoComplete="username"
                id={controlId}
                onChange={(event) => setEmail(event.target.value)}
                prefix={<Mail size={16} />}
                required
                type="email"
                value={email}
              />
            )}
          </FormField>
          <FormField label="密码" required>
            {({ controlId }) => (
              <Input
                autoComplete="current-password"
                id={controlId}
                onChange={(event) => setPassword(event.target.value)}
                prefix={<KeyRound size={16} />}
                required
                type="password"
                value={password}
              />
            )}
          </FormField>
          {error ? (
            <p className="admin-auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button block loading={busy} size="lg" type="submit">
            登录
          </Button>
          <a className="admin-auth-help-link" href={forgotPasswordHref}>
            忘记密码？通过邮箱安全重置
          </a>
        </form>
      </section>
      <aside className="admin-auth-aside">
        <span>LINGCOO FRAME</span>
        <h2>账号与权限由 Frame 提供，业务专注自己的工作流程。</h2>
        <p>身份、会话和访问控制保持稳定，行业应用只扩展自己的领域资料和业务页面。</p>
      </aside>
    </main>
  );
}

export function AdminChangePasswordPage() {
  const { account, changePassword } = useAdminAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '密码修改失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-password-screen">
      <form className="admin-password-panel" onSubmit={submit}>
        <span className="admin-password-icon">
          <KeyRound size={20} />
        </span>
        <p className="admin-eyebrow">First sign-in</p>
        <h1>设置你的正式密码</h1>
        <p className="admin-password-copy">
          {account?.email} 当前使用临时密码。修改后，其他已登录会话会自动失效。
        </p>
        <FormField label="当前密码" required>
          {({ controlId }) => (
            <Input
              autoComplete="current-password"
              id={controlId}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          )}
        </FormField>
        <FormField label="新密码" description="至少 12 个字符" required>
          {({ controlId, descriptionId }) => (
            <Input
              aria-describedby={descriptionId}
              autoComplete="new-password"
              id={controlId}
              minLength={12}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          )}
        </FormField>
        <FormField label="确认新密码" required>
          {({ controlId }) => (
            <Input
              autoComplete="new-password"
              id={controlId}
              minLength={12}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          )}
        </FormField>
        {error ? (
          <p className="admin-auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button block loading={busy} size="lg" type="submit">
          保存并进入后台
        </Button>
      </form>
    </main>
  );
}
