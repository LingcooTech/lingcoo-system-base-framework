import { Button } from '@lingcoo/frame-ui/button';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { KeyRound, Layers3, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { login } = useAuth();
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
      window.history.replaceState({}, '', '/admin/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <Layers3 size={18} />
          </span>
          <span>
            <strong>Lingcoo Base</strong>
            <small>Identity & Access</small>
          </span>
        </div>
        <div className="auth-heading">
          <p className="eyebrow">Secure console</p>
          <h1>登录管理后台</h1>
          <p>使用系统账号进入共享管理能力。</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <FormField label="邮箱" required>
            {({ controlId }) => (
              <Input
                autoComplete="username"
                id={controlId}
                prefix={<Mail size={16} />}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            )}
          </FormField>
          <FormField label="密码" required>
            {({ controlId }) => (
              <Input
                autoComplete="current-password"
                id={controlId}
                prefix={<KeyRound size={16} />}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            )}
          </FormField>
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button block loading={busy} size="lg" type="submit">
            登录
          </Button>
          <a className="auth-help-link" href="/auth/forgot-password">
            忘记密码？通过邮箱安全重置
          </a>
        </form>
      </section>
      <aside className="auth-aside">
        <span>FRAME / IAM</span>
        <h2>身份属于基础层，业务只扩展主体资料。</h2>
        <p>账号、会话、角色和权限保持稳定；教师、买家、员工等领域身份通过独立资料表关联。</p>
      </aside>
    </main>
  );
}
