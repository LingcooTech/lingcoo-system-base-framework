import { Button } from '@lingcoo/frame-ui/button';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useAuth } from '../lib/auth';

export function ChangePasswordPage() {
  const { account, changePassword } = useAuth();
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
    <main className="password-screen">
      <form className="password-panel" onSubmit={submit}>
        <span className="password-icon">
          <KeyRound size={20} />
        </span>
        <p className="eyebrow">First sign-in</p>
        <h1>设置你的正式密码</h1>
        <p className="password-copy">
          {account?.email} 当前使用临时密码。修改后，其他已登录会话会自动失效。
        </p>
        <FormField label="当前密码" required>
          {({ controlId }) => (
            <Input
              autoComplete="current-password"
              id={controlId}
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
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
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          )}
        </FormField>
        <FormField label="确认新密码" required>
          {({ controlId }) => (
            <Input
              autoComplete="new-password"
              id={controlId}
              minLength={12}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
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
          保存并进入后台
        </Button>
      </form>
    </main>
  );
}
