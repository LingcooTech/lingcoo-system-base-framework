import { Alert } from '@lingcoo/frame-ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@lingcoo/frame-ui/avatar';
import { Button } from '@lingcoo/frame-ui/button';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { Skeleton, SkeletonText } from '@lingcoo/frame-ui/skeleton';
import { useToast } from '@lingcoo/frame-ui/toast';
import { CheckCircle2, KeyRound, Laptop, MailCheck, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import {
  fetchAccountProfile,
  fetchAccountSecurityEvents,
  fetchAccountSessions,
  requestEmailVerification,
  revokeAccountSession,
  revokeOtherAccountSessions,
  updateAccountProfile,
  type AccountProfile,
  type AccountSecurityEvent,
  type AccountSession,
  type StorageAsset,
} from '../api/client';
import { AssetPicker } from '../components/shared/AssetPicker';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';

const eventLabels: Record<string, string> = {
  'auth.login': '账号登录',
  'auth.logout': '退出登录',
  'auth.password_changed': '修改密码',
  'auth.password_reset_completed': '完成密码重置',
  'auth.password_reset_requested': '申请密码重置',
  'auth.email_verification_requested': '申请邮箱验证',
  'auth.email_verified': '邮箱验证完成',
  'auth.account_invitation_requested': '账号邀请已发送',
  'auth.invitation_accepted': '账号邀请已接受',
  'auth.profile_updated': '更新个人资料',
  'auth.session_revoked': '撤销登录会话',
  'auth.other_sessions_revoked': '撤销其他会话',
};

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || 'LC';
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return '未知设备';
  const browser = userAgent.includes('Edg/')
    ? 'Edge'
    : userAgent.includes('Chrome/')
      ? 'Chrome'
      : userAgent.includes('Safari/')
        ? 'Safari'
        : userAgent.includes('Firefox/')
          ? 'Firefox'
          : '浏览器';
  const system = userAgent.includes('Mac OS')
    ? 'macOS'
    : userAgent.includes('Windows')
      ? 'Windows'
      : userAgent.includes('Android')
        ? 'Android'
        : userAgent.includes('iPhone')
          ? 'iPhone'
          : '其他系统';
  return `${browser} · ${system}`;
}

export function AccountPage() {
  const { account, changePassword, refresh } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [events, setEvents] = useState<AccountSecurityEvent[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [avatarAssetId, setAvatarAssetId] = useState<string | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<StorageAsset | undefined>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [nextProfile, nextSessions, nextEvents] = await Promise.all([
      fetchAccountProfile(),
      fetchAccountSessions(),
      fetchAccountSecurityEvents(),
    ]);
    setProfile(nextProfile);
    setDisplayName(nextProfile.displayName);
    setAvatarAssetId(nextProfile.avatarAssetId);
    setAvatarAsset(
      nextProfile.avatarUrl && nextProfile.avatarAssetId
        ? ({
            id: nextProfile.avatarAssetId,
            displayName: '当前头像',
            publicUrl: nextProfile.avatarUrl,
          } as StorageAsset)
        : undefined,
    );
    setSessions(nextSessions);
    setEvents(nextEvents);
  }

  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setLoadError('账号安全数据加载失败，请刷新后重试。'));
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await updateAccountProfile({ displayName, avatarAssetId });
      setProfile(saved);
      await refresh();
      toast({ title: '个人资料已保存', tone: 'success' });
    } catch (error) {
      toast({
        title: '个人资料保存失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: '密码已修改', description: '其他登录会话已失效。', tone: 'success' });
      await load();
    } catch (error) {
      toast({
        title: '密码修改失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  }

  async function sendVerification() {
    setBusy(true);
    try {
      await requestEmailVerification();
      toast({ title: '验证邮件已进入投递队列', tone: 'success' });
    } catch (error) {
      toast({
        title: '验证邮件发送失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(sessionId: string) {
    try {
      await revokeAccountSession(sessionId);
      toast({ title: '登录会话已撤销', tone: 'success' });
      await load();
    } catch (error) {
      toast({
        title: '会话撤销失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    }
  }

  async function revokeOthers() {
    try {
      const count = await revokeOtherAccountSessions();
      toast({ title: `已撤销 ${count} 个其他登录会话`, tone: 'success' });
      await load();
    } catch (error) {
      toast({
        title: '会话撤销失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    }
  }

  if (!profile && !loadError) {
    return (
      <PageFrame section={sections.account}>
        <div className="account-loading" aria-label="正在加载账号中心">
          <Skeleton shape="block" />
          <SkeletonText lines={4} />
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame section={sections.account}>
      {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
      <div className="account-overview">
        <Avatar size="lg">
          {profile?.avatarUrl ? <AvatarImage alt="" src={profile.avatarUrl} /> : null}
          <AvatarFallback>
            {initials(profile?.displayName ?? account?.displayName ?? '')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2>{profile?.displayName ?? account?.displayName}</h2>
          <p>{profile?.email ?? account?.email}</p>
        </div>
        <StatusPill tone={profile?.emailVerifiedAt ? 'ok' : 'neutral'}>
          {profile?.emailVerifiedAt ? '邮箱已验证' : '邮箱待验证'}
        </StatusPill>
      </div>

      <div className="account-grid">
        <ResourceSection title="个人资料" description="基础账号只保留跨行业都成立的稳定身份信息。">
          <form className="account-form" onSubmit={saveProfile}>
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
            <AssetPicker
              asset={avatarAsset}
              label="账号头像"
              onChange={(id, asset) => {
                setAvatarAssetId(id);
                setAvatarAsset(asset);
              }}
              value={avatarAssetId}
            />
            <Button loading={busy} type="submit">
              保存个人资料
            </Button>
          </form>
        </ResourceSection>

        <ResourceSection title="邮箱身份" description="验证状态属于账号内核，不承载行业资料。">
          <div className="account-email-card">
            {profile?.emailVerifiedAt ? <CheckCircle2 size={22} /> : <MailCheck size={22} />}
            <div>
              <strong>{profile?.email}</strong>
              <p>
                {profile?.emailVerifiedAt
                  ? `已于 ${new Date(profile.emailVerifiedAt).toLocaleString()} 完成验证`
                  : '验证链接使用一次后立即失效，有效期为 24 小时。'}
              </p>
            </div>
            {!profile?.emailVerifiedAt ? (
              <Button loading={busy} onClick={() => void sendVerification()} variant="secondary">
                发送验证邮件
              </Button>
            ) : null}
          </div>
        </ResourceSection>
      </div>

      <ResourceSection
        title="账号安全"
        description="修改密码会立即撤销除当前浏览器以外的全部有效会话。"
      >
        <form className="account-password-form" id="security" onSubmit={submitPassword}>
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
          <Button leadingIcon={<KeyRound size={15} />} loading={busy} type="submit">
            修改密码
          </Button>
        </form>
      </ResourceSection>

      <ResourceSection
        title="登录会话"
        description="账号可以查看和撤销自己的会话，但不能读取其他账号的会话。"
      >
        <div className="account-section-toolbar">
          <p>最多保留最近 30 条会话记录。</p>
          <Button onClick={() => void revokeOthers()} size="sm" variant="secondary">
            撤销其他会话
          </Button>
        </div>
        <div className="account-session-list">
          {sessions.map((session) => {
            const active = !session.revokedAt && new Date(session.expiresAt) > new Date();
            return (
              <article key={session.id}>
                <Laptop size={18} />
                <div>
                  <strong>
                    {deviceLabel(session.userAgent)} {session.current ? '· 当前会话' : ''}
                  </strong>
                  <small>
                    {session.ipAddress || '未知 IP'} · 最近活动{' '}
                    {new Date(session.lastSeenAt).toLocaleString()}
                  </small>
                </div>
                <StatusPill tone={active ? 'ok' : 'neutral'}>
                  {active ? '有效' : '已失效'}
                </StatusPill>
                {active && !session.current ? (
                  <Button onClick={() => void revoke(session.id)} size="sm" variant="ghost">
                    撤销
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      </ResourceSection>

      <ResourceSection title="安全记录" description="只显示当前账号自身的认证和安全操作。">
        <div className="account-event-list">
          {events.map((event) => (
            <article key={event.id}>
              <ShieldCheck size={16} />
              <span>{eventLabels[event.action] ?? event.action}</span>
              <time>{new Date(event.createdAt).toLocaleString()}</time>
            </article>
          ))}
          {!events.length ? <p>还没有安全操作记录。</p> : null}
        </div>
      </ResourceSection>
    </PageFrame>
  );
}
