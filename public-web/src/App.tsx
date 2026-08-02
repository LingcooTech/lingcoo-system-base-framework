import {
  ArrowRight,
  Boxes,
  Braces,
  Database,
  ExternalLink,
  Layers3,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@lingcoo/frame-ui/button';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PublicPresentation {
  displayName: string;
  shortName: string | null;
  slogan: string | null;
  fullLogoAssetId: string | null;
  squareLogoAssetId: string | null;
  faviconAssetId: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  seoTitle: string | null;
  seoDescription: string | null;
  headerNavigation: { label: string; href: string }[];
  footerCopyright: string | null;
  filingInfo: string | null;
  assets: Record<string, { publicUrl: string | null }>;
}

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

function CmsContentView({ endpoint, preview = false }: { endpoint: string; preview?: boolean }) {
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
      <main className="cms-public-state">
        <h1>内容不存在或暂不可访问</h1>
        <a href="/">返回首页</a>
      </main>
    );
  if (!content)
    return (
      <main className="cms-public-state">
        <p>正在加载内容…</p>
      </main>
    );
  const coverUrl = content.coverAssetId ? content.assets[content.coverAssetId]?.publicUrl : null;
  return (
    <main className="cms-public-page">
      <header className="cms-public-header">
        <a href="/">← 返回首页</a>
        {preview ? <span>草稿预览</span> : null}
      </header>
      <article>
        <p className="cms-public-type">{content.type === 'page' ? 'Page' : 'Article'}</p>
        <h1>{content.title}</h1>
        {content.excerpt ? <p className="cms-public-excerpt">{content.excerpt}</p> : null}
        {content.type === 'article' ? (
          <div className="cms-public-meta">
            <span>{content.author?.displayName || '系统编辑'}</span>
            {content.publishedAt ? (
              <time>{new Date(content.publishedAt).toLocaleDateString()}</time>
            ) : null}
          </div>
        ) : null}
        {coverUrl ? <img className="cms-public-cover" alt="" src={coverUrl} /> : null}
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
    </main>
  );
}

function ArticleIndex() {
  const [items, setItems] = useState<CmsContent[]>([]);
  useEffect(() => {
    fetch('/api/public/cms/articles')
      .then((response) => response.json())
      .then((result: { items: CmsContent[] }) => setItems(result.items))
      .catch(() => setItems([]));
  }, []);
  return (
    <main className="cms-public-index">
      <header>
        <a href="/">← 返回首页</a>
        <p>Content</p>
        <h1>文章</h1>
      </header>
      <div>
        {items.map((item) => (
          <a href={'/articles/' + item.slug} key={item.id}>
            <small>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ''}</small>
            <h2>{item.title}</h2>
            <p>{item.excerpt}</p>
          </a>
        ))}
      </div>
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

  const displayName = presentation?.displayName ?? 'Lingcoo Base';
  const logoId = presentation?.fullLogoAssetId ?? presentation?.squareLogoAssetId;
  const logoUrl = logoId ? presentation?.assets[logoId]?.publicUrl : null;
  const navigation = presentation?.headerNavigation.length
    ? presentation.headerNavigation
    : [
        { label: '基础架构', href: '#architecture' },
        { label: '运行状态', href: '/health' },
      ];

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'preview' && pathParts[1] === 'content' && pathParts[2]) {
    return <CmsContentView endpoint={'/api/cms/entries/' + pathParts[2] + '/preview'} preview />;
  }
  if (pathParts[0] === 'articles' && !pathParts[1]) return <ArticleIndex />;
  if ((pathParts[0] === 'articles' || pathParts[0] === 'pages') && pathParts[1]) {
    return (
      <CmsContentView
        endpoint={'/api/public/cms/' + pathParts[0] + '/' + encodeURIComponent(pathParts[1])}
      />
    );
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label={`${displayName} 首页`}>
          <span className="brand-mark">
            {logoUrl ? <img alt="" src={logoUrl} /> : (presentation?.shortName?.slice(0, 1) ?? 'L')}
          </span>
          <span>
            <strong>{displayName}</strong>
            <small>System Framework</small>
          </span>
        </a>
        <nav aria-label="主要导航">
          {navigation.map((item) => (
            <a href={item.href} key={`${item.label}-${item.href}`}>
              {item.label}
            </a>
          ))}
          <a className="admin-link" href="/admin/">
            管理后台
            <ExternalLink size={14} />
          </a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-content">
          <p className="eyebrow">
            <span />
            Domain-ready foundation
          </p>
          <h1>
            一套专注于
            <em>业务展开之前</em>
            的系统基础框架
          </h1>
          <p className="hero-copy">
            它不是生成器，也不预设任何行业。公共 Web、管理后台、服务端、数据库和部署能力已经就位，
            新系统只需在稳定边界内增加自己的领域模型与业务模块。
          </p>
          <div className="hero-actions">
            <Button asChild size="lg" trailingIcon={<ArrowRight size={16} />}>
              <a href="/admin/">查看管理后台</a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#architecture">了解架构</a>
            </Button>
          </div>
        </div>
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
      </section>

      <section className="principles">
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
      </section>

      <section className="architecture" id="architecture">
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
      </section>

      <footer>
        <div>
          <span className="brand-mark">L</span>
          <strong>{displayName}</strong>
        </div>
        <p>
          {presentation?.footerCopyright ||
            presentation?.slogan ||
            'Foundation first. Domain follows.'}
          {presentation?.filingInfo ? ` · ${presentation.filingInfo}` : ''}
        </p>
      </footer>
    </main>
  );
}

export default App;
