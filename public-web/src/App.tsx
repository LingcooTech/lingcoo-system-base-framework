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
import { Breadcrumb } from '@lingcoo/frame-ui/breadcrumb';
import { EmptyState } from '@lingcoo/frame-ui/empty-state';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { ResponsiveImage } from '@lingcoo/frame-ui/responsive-image';
import { Skeleton, SkeletonText } from '@lingcoo/frame-ui/skeleton';
import { useEffect, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Hero, PageHeader, Section } from './components/site/Layout';
import { SiteShell, type PublicPresentation } from './components/site/SiteShell';

interface CmsContent {
  id: string;
  type: 'article' | 'page';
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverAssetId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  author: { displayName: string } | null;
  terms: { id: string; name: string; color: string | null }[];
  assets: Record<string, { publicUrl: string | null }>;
}

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

function CmsContentView({
  endpoint,
  presentation,
  preview = false,
}: {
  endpoint: string;
  presentation: PublicPresentation | null;
  preview?: boolean;
}) {
  const [content, setContent] = useState<CmsContent | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(endpoint)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('missing'))))
      .then((result: { content: CmsContent }) => {
        setContent(result.content);
        document.title = result.content.seoTitle || result.content.title;
        const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (description && result.content.seoDescription)
          description.content = result.content.seoDescription;
      })
      .catch(() => setMissing(true));
  }, [endpoint]);

  if (missing)
    return (
      <SiteShell presentation={presentation}>
        <Section className="cms-public-state" containerSize="content">
          <EmptyState
            action={<a href="/">返回首页</a>}
            description="内容可能尚未发布、已被移动，或者链接不完整。"
            title="内容不存在或暂不可访问"
            variant="error"
          />
        </Section>
      </SiteShell>
    );
  if (!content)
    return (
      <SiteShell presentation={presentation}>
        <Section className="cms-public-state" containerSize="content">
          <div className="cms-public-loading" aria-label="正在加载内容">
            <Skeleton style={{ height: 34, width: '58%' }} />
            <SkeletonText lines={4} />
            <Skeleton shape="block" style={{ minHeight: 260 }} />
          </div>
        </Section>
      </SiteShell>
    );
  const coverUrl = content.coverAssetId ? content.assets[content.coverAssetId]?.publicUrl : null;
  return (
    <SiteShell presentation={presentation}>
      <Section className="cms-public-page" containerSize="content">
        <div className="cms-public-header">
          <Breadcrumb
            items={[
              { href: '/', label: '首页' },
              ...(content.type === 'article' ? [{ href: '/articles', label: '文章' }] : []),
              { label: content.title },
            ]}
          />
          {preview ? <span>草稿预览</span> : null}
        </div>
        <article>
          <PageHeader
            description={content.excerpt}
            eyebrow={content.type === 'page' ? 'Page' : 'Article'}
            meta={
              content.type === 'article' ? (
                <>
                  <span>{content.author?.displayName || '系统编辑'}</span>
                  {content.publishedAt ? (
                    <time>{new Date(content.publishedAt).toLocaleDateString()}</time>
                  ) : null}
                </>
              ) : null
            }
            title={content.title}
          />
          {coverUrl ? (
            <ResponsiveImage
              alt={content.title}
              aspectRatio="16 / 9"
              className="cms-public-cover"
              src={coverUrl}
              wrapperClassName="cms-public-cover-frame"
            />
          ) : null}
          {content.terms.length ? (
            <div className="cms-public-terms">
              {content.terms.map((term) => (
                <span key={term.id} style={term.color ? { borderColor: term.color } : undefined}>
                  {term.name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="cms-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.body}</ReactMarkdown>
          </div>
        </article>
      </Section>
    </SiteShell>
  );
}

function ArticleIndex({ presentation }: { presentation: PublicPresentation | null }) {
  const [items, setItems] = useState<CmsContent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/public/cms/articles')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((result: { items: CmsContent[] }) => setItems(result.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  return (
    <SiteShell presentation={presentation}>
      <Section className="cms-public-index" containerSize="content">
        <PageHeader description="由轻量内容中心发布的公共文章。" eyebrow="Content" title="文章" />
        <div className="cms-public-index__items">
          {loading ? (
            <div className="cms-public-index-loading">
              <Skeleton shape="block" />
              <Skeleton shape="block" />
            </div>
          ) : null}
          {!loading && !items.length ? (
            <EmptyState description="发布第一篇文章后，它会显示在这里。" title="暂时还没有文章" />
          ) : null}
          {!loading &&
            items.map((item) => (
              <a href={'/articles/' + item.slug} key={item.id}>
                <small>
                  {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ''}
                </small>
                <h2>{item.title}</h2>
                <p>{item.excerpt}</p>
              </a>
            ))}
        </div>
      </Section>
    </SiteShell>
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
        document.title = result.seoTitle || result.displayName;
        const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (description && result.seoDescription) description.content = result.seoDescription;
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

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'auth') {
    const mode =
      pathParts[1] === 'forgot-password'
        ? 'forgot'
        : pathParts[1] === 'reset-password'
          ? 'reset'
          : pathParts[1] === 'accept-invitation'
            ? 'invitation'
            : pathParts[1] === 'verify-email'
              ? 'verify'
              : null;
    if (mode) return <PublicAuthFlow mode={mode} presentation={presentation} />;
  }
  if (pathParts[0] === 'preview' && pathParts[1] === 'content' && pathParts[2]) {
    return (
      <CmsContentView
        endpoint={'/api/cms/entries/' + pathParts[2] + '/preview'}
        presentation={presentation}
        preview
      />
    );
  }
  if (pathParts[0] === 'articles' && !pathParts[1])
    return <ArticleIndex presentation={presentation} />;
  if ((pathParts[0] === 'articles' || pathParts[0] === 'pages') && pathParts[1]) {
    return (
      <CmsContentView
        endpoint={'/api/public/cms/' + pathParts[0] + '/' + encodeURIComponent(pathParts[1])}
        presentation={presentation}
      />
    );
  }

  return (
    <SiteShell headerOverlay headerTone="dark" presentation={presentation}>
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

export default App;
