import { Alert } from '@lingcoo/frame-ui/alert';
import { Button } from '@lingcoo/frame-ui/button';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { KeyRound, Mail } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import type { PublicPresentation } from './presentation.js';
import { SeoHead } from './seo.js';

export type PublicAuthMode = 'forgot' | 'reset' | 'invitation' | 'verify';

export interface PublicAuthRequest {
  (path: string, body: Record<string, unknown>): Promise<void>;
}

async function defaultAuthRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? '安全操作失败，请稍后重试');
  }
}

export function publicAuthModeFromRoute(value: string | undefined): PublicAuthMode | null {
  if (value === 'forgot-password') return 'forgot';
  if (value === 'reset-password') return 'reset';
  if (value === 'accept-invitation') return 'invitation';
  if (value === 'verify-email') return 'verify';
  return null;
}

export function PublicAuthFlow({
  loginHref = '/admin/',
  mode,
  presentation,
  request = defaultAuthRequest,
  token: suppliedToken,
}: {
  loginHref?: string;
  mode: PublicAuthMode;
  presentation: PublicPresentation | null;
  request?: PublicAuthRequest;
  token?: string;
}) {
  const token =
    suppliedToken ??
    (typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('token') ?? ''));
  const invalidVerification = mode === 'verify' && !token;
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(mode === 'verify' && Boolean(token));
  const [message, setMessage] = useState(invalidVerification ? '验证链接缺少安全凭证。' : '');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (mode !== 'verify' || !token) return;
    request('/api/auth/email/verify', { token })
      .then(() => {
        setCompleted(true);
        setMessage('邮箱验证已完成。');
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '邮箱验证失败'))
      .finally(() => setBusy(false));
  }, [mode, request, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'forgot') {
        await request('/api/auth/password-reset/request', { email });
        setMessage('如果该邮箱对应可用账号，重置邮件将很快送达。');
      } else {
        await request(
          mode === 'invitation'
            ? '/api/auth/invitations/accept'
            : '/api/auth/password-reset/complete',
          { token, newPassword, confirmPassword },
        );
        setCompleted(true);
        setMessage(mode === 'invitation' ? '账号已启用，可以登录管理后台。' : '密码已重置。');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '安全操作失败');
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === 'forgot'
      ? '找回账号密码'
      : mode === 'invitation'
        ? '接受账号邀请'
        : mode === 'verify'
          ? '验证账号邮箱'
          : '设置新的密码';
  const authLogoId = presentation?.squareLogoAssetId ?? presentation?.fullLogoAssetId;
  const authLogoUrl = authLogoId ? presentation?.assets[authLogoId]?.publicUrl : null;
  return (
    <main className="public-auth-screen">
      <SeoHead noIndex presentation={presentation} title={title} />
      <section className="public-auth-card">
        <a className="public-auth-brand" href="/">
          <span>{authLogoUrl ? <img alt="" src={authLogoUrl} /> : 'F'}</span>
          {presentation?.displayName ?? 'Lingcoo Frame'}
        </a>
        <div className="public-auth-icon">
          {mode === 'forgot' ? <Mail size={20} /> : <KeyRound size={20} />}
        </div>
        <p className="public-auth-type">Account security</p>
        <h1>{title}</h1>
        <p className="public-auth-copy">
          {mode === 'forgot'
            ? '输入账号邮箱。为保护账号隐私，无论邮箱是否存在都会返回相同结果。'
            : mode === 'verify'
              ? '正在校验一次性邮箱验证链接。'
              : '安全链接只能使用一次；新密码至少需要 12 个字符。'}
        </p>
        {mode !== 'verify' && !completed ? (
          <form onSubmit={submit}>
            {mode === 'forgot' ? (
              <FormField label="账号邮箱" required>
                {({ controlId }) => (
                  <Input
                    autoComplete="email"
                    id={controlId}
                    onChange={(event) => setEmail(event.target.value)}
                    prefix={<Mail size={15} />}
                    required
                    type="email"
                    value={email}
                  />
                )}
              </FormField>
            ) : (
              <>
                <FormField label="新密码" required>
                  {({ controlId }) => (
                    <Input
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
              </>
            )}
            <Button block loading={busy} size="lg" type="submit">
              {mode === 'forgot' ? '发送重置邮件' : '确认并继续'}
            </Button>
          </form>
        ) : null}
        {message ? (
          <Alert tone={completed || mode === 'forgot' ? 'success' : 'danger'}>{message}</Alert>
        ) : null}
        <a className="public-auth-login" href={loginHref}>
          返回管理后台登录
        </a>
      </section>
    </main>
  );
}
