import {
  ArrowRight,
  Boxes,
  Braces,
  Database,
  Layers3,
  ShieldCheck,
  KeyRound,
  Mail,
} from 'lucide-react';
import { Button } from '@lingcoo/frame-ui/button';
import { Alert } from '@lingcoo/frame-ui/alert';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcoo/frame-extension-sdk';
import {
  createWebRegistry,
  defineWebExtension,
  WebRouteSlot,
  WebShell,
  type WebRouteContext,
} from '@lingcoo/frame-web';
import { frameWebManifest } from '@lingcoo/frame-web/manifest';
import { useEffect, useState, type FormEvent } from 'react';

import { ArticleIndexPage, CmsContentPage } from './components/cms/CmsPages';
import { Hero, Section } from './components/site/Layout';
import { SeoHead } from './components/site/SeoHead';
import { SiteShell, type PublicPresentation } from './components/site/SiteShell';
import { SystemPage } from './components/site/SystemStates';

async function authRequest(path: string, body: Record<string, unknown>) {
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

function PublicAuthFlow({
  mode,
  presentation,
}: {
  mode: 'forgot' | 'reset' | 'invitation' | 'verify';
  presentation: PublicPresentation | null;
}) {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const invalidVerification = mode === 'verify' && !token;
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(mode === 'verify' && Boolean(token));
  const [message, setMessage] = useState(invalidVerification ? '验证链接缺少安全凭证。' : '');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (mode !== 'verify' || !token) return;
    authRequest('/api/auth/email/verify', { token })
      .then(() => {
        setCompleted(true);
        setMessage('邮箱验证已完成。');
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '邮箱验证失败'))
      .finally(() => setBusy(false));
  }, [mode, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'forgot') {
        await authRequest('/api/auth/password-reset/request', { email });
        setMessage('如果该邮箱对应可用账号，重置邮件将很快送达。');
      } else {
        await authRequest(
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
        <p className="cms-public-type">Account security</p>
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
        <a className="public-auth-login" href="/admin/">
          返回管理后台登录
        </a>
      </section>
    </main>
  );
}

const layers = [
  {
    icon: Braces,
    label: 'Application',
    title: '公共 Web 与管理后台',
    copy: '两套独立前端入口，保留清晰的产品边界，也共享一致的视觉与工程规范。',
  },
  {
    icon: Boxes,
    label: 'Modules',
    title: '可扩展模块边界',
    copy: '基础框架只注册系统模块，后续领域能力按模块接入，不污染框架内核。',
  },
  {
    icon: Database,
    label: 'Infrastructure',
    title: 'API、数据库与部署',
    copy: 'Fastify、PostgreSQL、Docker 与 Caddy 组成一条完整且精简的运行链路。',
  },
];

interface PublicWebContext {
  presentation: PublicPresentation | null;
}

function HomeRoute({ context }: WebRouteContext<PublicWebContext>) {
  const { presentation } = context;
  return (
    <SiteShell headerOverlay headerTone="dark" presentation={presentation}>
      <SeoHead canonicalPath="/" presentation={presentation} />
      <Hero
        actions={
          <>
            <Button asChild size="lg" trailingIcon={<ArrowRight size={16} />}>
              <a href="/admin/">查看管理后台</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#architecture">了解架构</a>
            </Button>
          </>
        }
        aside={
          <div className="architecture-card" aria-label="基础框架结构示意">
            <div className="card-header">
              <span>framework.layers</span>
              <span className="live-indicator">ready</span>
            </div>
            <div className="layer-stack">
              <div>
                <span>01</span>
                <strong>Public Web</strong>
                <small>React · Vite</small>
              </div>
              <div>
                <span>02</span>
                <strong>Admin Console</strong>
                <small>React · Modular UI</small>
              </div>
              <div>
                <span>03</span>
                <strong>Application API</strong>
                <small>Fastify · TypeScript</small>
              </div>
              <div>
                <span>04</span>
                <strong>Data & Runtime</strong>
                <small>PostgreSQL · Docker</small>
              </div>
            </div>
          </div>
        }
        description={
          <p>
            它不是生成器，也不预设任何行业。公共 Web、管理后台、服务端、数据库和部署能力已经就位，
            新系统只需在稳定边界内增加自己的领域模型与业务模块。
          </p>
        }
        eyebrow="Domain-ready foundation"
        title={
          <>
            一套专注于
            <em>业务展开之前</em>
            的系统基础框架
          </>
        }
      />

      <Section className="principles-section" spacing="sm">
        <div className="principles">
          <div>
            <Layers3 size={20} />
            <span>完整，而非庞杂</span>
          </div>
          <div>
            <ShieldCheck size={20} />
            <span>默认具备生产边界</span>
          </div>
          <div>
            <Boxes size={20} />
            <span>通过模块承载业务</span>
          </div>
        </div>
      </Section>

      <Section className="architecture-section" id="architecture">
        <div className="section-heading">
          <p>Shared foundation</p>
          <h2>基础能力留在框架，领域能力进入模块</h2>
          <span>
            框架维护通用技术约束与运行方式；教育、零售或其他系统只维护各自的数据模型、流程和界面。
          </span>
        </div>
        <div className="layer-cards">
          {layers.map(({ icon: Icon, label, title, copy }, index) => (
            <article key={title}>
              <div className="card-number">0{index + 1}</div>
              <Icon size={21} />
              <small>{label}</small>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </Section>
    </SiteShell>
  );
}

function AuthRoute({ context, params }: WebRouteContext<PublicWebContext>) {
  const mode =
    params.mode === 'forgot-password'
      ? 'forgot'
      : params.mode === 'reset-password'
        ? 'reset'
        : params.mode === 'accept-invitation'
          ? 'invitation'
          : params.mode === 'verify-email'
            ? 'verify'
            : null;
  return mode ? (
    <PublicAuthFlow mode={mode} presentation={context.presentation} />
  ) : (
    <SystemPage kind="404" presentation={context.presentation} />
  );
}

function PreviewContentRoute({ context, params }: WebRouteContext<PublicWebContext>) {
  return (
    <CmsContentPage
      endpoint={`/api/cms/entries/${encodeURIComponent(params.id!)}/preview`}
      presentation={context.presentation}
      preview
    />
  );
}

function ArticleIndexRoute({ context, searchParams }: WebRouteContext<PublicWebContext>) {
  const requestedPage = Number(searchParams.get('page') || '1');
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return <ArticleIndexPage page={page} presentation={context.presentation} />;
}

function ArticleRoute({ context, params }: WebRouteContext<PublicWebContext>) {
  return (
    <CmsContentPage
      endpoint={`/api/public/cms/articles/${encodeURIComponent(params.slug!)}`}
      presentation={context.presentation}
    />
  );
}

function PageRoute({ context, params }: WebRouteContext<PublicWebContext>) {
  return (
    <CmsContentPage
      endpoint={`/api/public/cms/pages/${encodeURIComponent(params.slug!)}`}
      presentation={context.presentation}
    />
  );
}

const frameWebSurface = defineWebExtension<PublicWebContext>({
  routes: [
    { id: 'frame.auth', component: AuthRoute },
    { id: 'frame.preview-content', component: PreviewContentRoute },
    { id: 'frame.articles', component: ArticleIndexRoute },
    { id: 'frame.article', component: ArticleRoute },
    { id: 'frame.page', component: PageRoute },
    { id: 'frame.home', component: HomeRoute },
  ],
  seo: [
    {
      id: 'frame.home',
      resolve() {
        return { canonicalPath: '/' };
      },
    },
    {
      id: 'frame.articles',
      resolve({ searchParams }) {
        const page = Number(searchParams.get('page') || '1');
        return {
          title: '文章',
          canonicalPath: page > 1 ? `/articles?page=${page}` : '/articles',
        };
      },
    },
  ],
  sitemap: [
    {
      id: 'frame.public-content',
      collect() {
        return [
          { path: '/', changeFrequency: 'weekly', priority: 1 },
          { path: '/articles', changeFrequency: 'daily', priority: 0.8 },
        ];
      },
    },
  ],
});

const frameWebDefinition = defineExtension({
  manifest: {
    id: 'frame',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    web: frameWebManifest,
  },
  web: frameWebSurface,
});

const publicWebSystem = defineSystem({
  id: 'frame-reference-web',
  version: FRAME_VERSION,
  extensions: [frameWebDefinition],
});

const webRegistry = createWebRegistry<PublicWebContext>(publicWebSystem);

function App() {
  const [presentation, setPresentation] = useState<PublicPresentation | null>(null);

  useEffect(() => {
    fetch('/api/public/presentation')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then(({ presentation: result }: { presentation: PublicPresentation }) => {
        setPresentation(result);
        document.documentElement.style.setProperty('--site-primary', result.primaryColor);
        document.documentElement.style.setProperty('--site-secondary', result.secondaryColor);
        document.documentElement.style.setProperty('--site-accent', result.accentColor);
        const faviconUrl = result.faviconAssetId
          ? result.assets[result.faviconAssetId]?.publicUrl
          : null;
        if (faviconUrl) {
          let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.append(favicon);
          }
          favicon.href = faviconUrl;
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <WebShell registry={webRegistry}>
      <WebRouteSlot<PublicWebContext>
        context={{ presentation }}
        notFound={<SystemPage kind="404" presentation={presentation} />}
        pathname={window.location.pathname}
        searchParams={new URLSearchParams(window.location.search)}
      />
    </WebShell>
  );
}

export default App;
