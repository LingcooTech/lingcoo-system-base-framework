import {
  ArrowRight,
  Blocks,
  Check,
  ChevronRight,
  CircleGauge,
  Code2,
  Database,
  FileCode2,
  GitBranch,
  Layers3,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@lingcootech/frame-ui/button';
import { ResponsiveImage } from '@lingcootech/frame-ui/responsive-image';
import { PageHeader, Section } from '@lingcootech/frame-web/layout';
import type { PublicPresentation, PublicNavigationItem } from '@lingcootech/frame-web/presentation';
import { SeoHead } from '@lingcootech/frame-web/seo';
import { SiteShell } from '@lingcootech/frame-web/site';
import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';

const officialNavigation: PublicNavigationItem[] = [
  { label: '框架', href: '/framework' },
  { label: '架构', href: '/architecture' },
  { label: 'Packages', href: '/packages' },
  { label: '扩展', href: '/extensions' },
  { label: '文档', href: '/docs' },
];

const officialFooterLinks: PublicNavigationItem[] = [
  { label: '快速开始', href: '/docs/platform-roadmap' },
  { label: '扩展开发', href: '/docs/extension-development' },
  { label: '在线 Console', href: '/admin/' },
];

interface OfficialSiteProps {
  children: ReactNode;
  presentation: PublicPresentation | null;
  dark?: boolean;
}

export function OfficialSite({ children, dark = false, presentation }: OfficialSiteProps) {
  const configuredNavigation = presentation?.headerNavigation ?? [];
  const configuredFooterLinks = presentation?.footerLinks ?? [];
  const navigation = configuredNavigation.length ? configuredNavigation : officialNavigation;
  const footerLinks = configuredFooterLinks.length ? configuredFooterLinks : officialFooterLinks;
  return (
    <SiteShell
      adminLabel="打开 Console"
      headerNavigation={navigation}
      headerOverlay={dark}
      headerTone={dark ? 'dark' : 'light'}
      presentation={presentation}
      footerLinks={footerLinks}
    >
      {children}
    </SiteShell>
  );
}

const packageGroups = [
  {
    title: 'Runtime',
    description: '把服务端、Worker、数据库和迁移组合成一个可部署系统。',
    packages: [
      '@lingcootech/frame',
      '@lingcootech/frame-database',
      '@lingcootech/frame-extension-sdk',
    ],
    icon: ServerCog,
  },
  {
    title: 'Experience',
    description: '提供业务系统可以直接使用的公共 Web、后台和无业务 UI。',
    packages: ['@lingcootech/frame-admin', '@lingcootech/frame-web', '@lingcootech/frame-ui'],
    icon: Layers3,
  },
  {
    title: 'First-party',
    description: '按需安装的 CMS 扩展，覆盖内容工作流和公共内容页面。',
    packages: ['@lingcootech/frame-cms', '@lingcootech/frame-design-tokens'],
    icon: Blocks,
  },
];

const capabilities: [string, string, LucideIcon][] = [
  ['运行边界', 'Fastify、PostgreSQL、Worker、Docker 和健康探针。', ServerCog],
  ['身份安全', 'HttpOnly Cookie、可撤销会话、RBAC 和统一权限门禁。', LockKeyhole],
  ['扩展组合', 'Server、Worker、Migration、Admin 和 Web 使用同一 Manifest。', GitBranch],
  ['内容与呈现', '品牌、站点壳、CMS、SEO、Sitemap 和公共状态页。', Sparkles],
];

const architectureBranches: [string, string, LucideIcon][] = [
  ['Backend', 'server.ts · worker.ts · migrate.ts', ServerCog],
  ['Admin', 'Shell · routes · business navigation', ShieldCheck],
  ['Public Web', 'SiteShell · SEO · pages · CMS', Sparkles],
  ['Packages', 'Frame · SDK · database · UI', Blocks],
];

const extensionSurfaces: [string, string, LucideIcon][] = [
  ['Server', 'Fastify 路由和 Service Port', ServerCog],
  ['Worker', '持久化 Job 与 Outbox Subscriber', CircleGauge],
  ['Migration', '命名空间 SQL 和 Legacy Alias', Database],
  ['Admin', '业务页面、导航和搜索 Provider', ShieldCheck],
  ['Web', '公共路由、SEO 和 Sitemap', Sparkles],
  ['Contracts', '浏览器安全的共享类型和 Manifest', FileCode2],
];

export function HomePage({ presentation }: { presentation: PublicPresentation | null }) {
  return (
    <OfficialSite dark presentation={presentation}>
      <SeoHead canonicalPath="/" presentation={presentation} />
      <section className="reference-hero">
        <div className="reference-hero__grid" aria-hidden />
        <div className="reference-container reference-hero__inner">
          <div className="reference-hero__copy">
            <p className="reference-eyebrow">
              <span /> Domain-ready foundation
            </p>
            <h1>Lingcoo Frame</h1>
            <p className="reference-hero__lead">
              为轻量、自有、快速部署的行业系统准备好的基础框架。
            </p>
            <p className="reference-hero__body">
              Frame 把运行环境、身份安全、后台壳、公共
              Web、扩展协议、数据库和部署边界整理成可升级的底座。
              业务系统只需要在稳定边界内展开自己的领域模型和工作流。
            </p>
            <div className="reference-actions">
              <Button asChild size="lg" trailingIcon={<ArrowRight size={16} />}>
                <a href="/docs/platform-roadmap">开始阅读</a>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="/admin/">打开在线 Console</a>
              </Button>
            </div>
            <p className="reference-hero__meta">
              Frame {FRAME_VERSION} · TypeScript · PostgreSQL · Docker
            </p>
          </div>
          <div className="reference-system-map" aria-label="Frame 系统层次图">
            <div className="reference-system-map__topline">
              <span>defined-system</span>
              <b>ready</b>
            </div>
            <div className="reference-system-map__stack">
              <div>
                <span>01</span>
                <strong>Public Web</strong>
                <small>brand · SEO · CMS</small>
              </div>
              <div>
                <span>02</span>
                <strong>Admin Console</strong>
                <small>auth · access · operations</small>
              </div>
              <div>
                <span>03</span>
                <strong>Application API</strong>
                <small>Fastify · extensions</small>
              </div>
              <div>
                <span>04</span>
                <strong>Data & Worker</strong>
                <small>PostgreSQL · jobs · outbox</small>
              </div>
            </div>
            <div className="reference-system-map__footer">
              <CircleGauge size={14} /> one system · four runtime surfaces
            </div>
          </div>
        </div>
      </section>
      <Section className="reference-proof-strip" spacing="sm">
        <div className="reference-proof-grid">
          {[
            ['01', '完整，而非庞杂', '只把跨行业成立的能力留在底座。'],
            ['02', '默认具备生产边界', '安全、迁移、健康和部署路径已经就位。'],
            ['03', '通过模块承载业务', '领域系统以扩展接入，不复制框架源码。'],
          ].map(([number, title, copy]) => (
            <div key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{copy}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section className="reference-section" id="framework">
        <PageHeader
          eyebrow="What Frame provides"
          title="让业务从正确的边界开始"
          description="Frame 不是行业模板，也不是低代码生成器。它提供一套可以安装、组合、升级和部署的系统底座。"
          actions={
            <Button asChild variant="ghost" trailingIcon={<ChevronRight size={15} />}>
              <a href="/framework">查看 Frame 能力</a>
            </Button>
          }
        />
        <div className="reference-capability-grid">
          {capabilities.map(([title, copy, Icon]) => {
            const CapabilityIcon = Icon as typeof ServerCog;
            return (
              <article key={String(title)}>
                <CapabilityIcon size={20} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            );
          })}
        </div>
      </Section>
      <Section className="reference-section reference-section--dark" id="architecture">
        <div className="reference-split-heading">
          <div>
            <p className="reference-kicker">Architecture</p>
            <h2>底层默默工作，业务保持清晰</h2>
          </div>
          <p>
            一个 Defined System 同时驱动 API、Worker、迁移、Admin 和公共
            Web。应用只拥有自己的领域内容。
          </p>
        </div>
        <div className="reference-flow">
          <div>
            <Code2 size={18} />
            <strong>Consumer App</strong>
            <small>领域模型 · 页面 · 工作流</small>
          </div>
          <ArrowRight />
          <div>
            <GitBranch size={18} />
            <strong>Frame Extensions</strong>
            <small>Manifest · contracts · ports</small>
          </div>
          <ArrowRight />
          <div>
            <Database size={18} />
            <strong>Frame Runtime</strong>
            <small>API · Worker · PostgreSQL</small>
          </div>
        </div>
        <Button asChild variant="secondary" trailingIcon={<ArrowRight size={15} />}>
          <a href="/architecture">阅读架构说明</a>
        </Button>
      </Section>
      <Section className="reference-section">
        <PageHeader
          eyebrow="Online reference"
          title="把框架能力放到一个可运行的系统里"
          description="这个站点本身就是 Frame 的 Reference Consumer。公共站点展示产品边界，Console 用来验证实际管理能力。"
        />
        <div className="reference-console-callout">
          <div className="reference-console-callout__visual">
            <ResponsiveImage
              alt="Lingcoo Frame Console 登录界面"
              className="reference-console-screenshot"
              fit="contain"
              src="/images/frame-console.png"
            />
          </div>
          <div>
            <p className="reference-kicker">Reference Console</p>
            <h2>需要看运行情况时，再进入幕后</h2>
            <p>业务导航始终优先。Frame 版本、扩展、迁移、任务和可观测性从页脚和受保护入口进入。</p>
            <a className="reference-text-link" href="/admin/">
              进入 Console <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </Section>
    </OfficialSite>
  );
}

export function FrameworkPage({ presentation }: { presentation: PublicPresentation | null }) {
  return (
    <OfficialSite presentation={presentation}>
      <SeoHead canonicalPath="/framework" presentation={presentation} title="Frame 能力" />
      <Section className="reference-section">
        <PageHeader
          eyebrow="Framework"
          title="一套可以被业务系统调用的底座"
          description="Frame Core 自带运行、网络、安全、身份、数据和扩展运行时；应用层负责领域业务、品牌内容和具体工作流。"
        />
        <div className="reference-feature-list">
          {capabilities.map(([title, copy, Icon]) => {
            const CapabilityIcon = Icon as typeof ServerCog;
            return (
              <article key={String(title)}>
                <CapabilityIcon size={20} />
                <div>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </div>
                <Check size={18} />
              </article>
            );
          })}
        </div>
      </Section>
      <Section className="reference-section reference-section--muted">
        <div className="reference-split-heading">
          <div>
            <p className="reference-kicker">Boundary</p>
            <h2>Frame 自带什么，开发者开发什么</h2>
          </div>
          <p>
            判断标准很简单：删除所有行业业务后仍成立，并且教育、零售、官网都以相同方式使用，才进入
            Frame。
          </p>
        </div>
        <div className="reference-boundary-grid">
          <div>
            <span>Frame Core</span>
            <h3>提供舞台</h3>
            <p>
              HTTP
              宿主、Cookie/JWT、数据库生命周期、请求上下文、日志、限流、错误处理、健康探针和扩展组合。
            </p>
          </div>
          <div>
            <span>Consumer App</span>
            <h3>展开业务</h3>
            <p>
              领域模型、业务流程、页面内容、业务权限、应用导航、品牌资料以及行业系统自己的部署配置。
            </p>
          </div>
        </div>
      </Section>
    </OfficialSite>
  );
}

export function ArchitecturePage({ presentation }: { presentation: PublicPresentation | null }) {
  return (
    <OfficialSite presentation={presentation}>
      <SeoHead canonicalPath="/architecture" presentation={presentation} title="Frame 架构" />
      <Section className="reference-section">
        <PageHeader
          eyebrow="Architecture"
          title="从一个组合根到四个运行面"
          description="代码目录和架构层级保持一致，应用只在组合根决定安装哪些能力。"
        />
        <div className="reference-architecture-tree">
          <div className="tree-root">
            <FileCode2 size={18} />
            <strong>DefinedSystem</strong>
            <small>system.ts</small>
          </div>
          <div className="tree-branches">
            {architectureBranches.map(([title, copy, BranchIcon]) => (
              <article key={title}>
                <BranchIcon size={18} />
                <strong>{title}</strong>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </Section>
      <Section className="reference-section reference-section--dark">
        <div className="reference-split-heading">
          <div>
            <p className="reference-kicker">Read the code</p>
            <h2>先读组合根，再读运行面</h2>
          </div>
          <p>
            从 `apps/reference-system/src/system.ts` 开始，向下确认
            manifest、server、worker、migration 和前端扩展如何绑定。
          </p>
        </div>
        <div className="reference-reading-order">
          {[
            'apps/reference-system/src/system.ts',
            'packages/frame/src/host/app.ts',
            'packages/frame/src/core/modules/',
            'packages/extension-sdk/src/',
            'apps/reference-web/src/site/',
          ].map((item, index) => (
            <div key={item}>
              <span>0{index + 1}</span>
              <code>{item}</code>
              <ChevronRight size={15} />
            </div>
          ))}
        </div>
      </Section>
    </OfficialSite>
  );
}

export function PackagesPage({ presentation }: { presentation: PublicPresentation | null }) {
  return (
    <OfficialSite presentation={presentation}>
      <SeoHead canonicalPath="/packages" presentation={presentation} title="Frame Packages" />
      <Section className="reference-section">
        <PageHeader
          eyebrow="Packages"
          title="可安装、可升级、边界清晰"
          description="packages 是行业系统长期依赖的边界；apps 只负责证明这些包可以组成一个完整系统。"
        />
        <div className="reference-package-groups">
          {packageGroups.map(({ title, description, packages, icon: Icon }) => (
            <article key={title}>
              <Icon size={20} />
              <p className="reference-kicker">{title}</p>
              <h2>{title}</h2>
              <p>{description}</p>
              <ul>
                {packages.map((item) => (
                  <li key={item}>
                    <code>{item}</code>
                    <ChevronRight size={14} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>
      <Section className="reference-section reference-section--muted">
        <div className="reference-split-heading">
          <div>
            <p className="reference-kicker">Consumer contract</p>
            <h2>业务系统不复制 Frame 源码</h2>
          </div>
          <p>
            Consumer 安装版本化包，组合自己的 System，并在升级时按公开契约验证。Reference App
            不是公共 API。
          </p>
        </div>
        <Button asChild trailingIcon={<ArrowRight size={15} />}>
          <a href="/docs/package-contracts">查看 Package Contracts</a>
        </Button>
      </Section>
    </OfficialSite>
  );
}

export function ExtensionsPage({ presentation }: { presentation: PublicPresentation | null }) {
  return (
    <OfficialSite presentation={presentation}>
      <SeoHead canonicalPath="/extensions" presentation={presentation} title="Frame Extensions" />
      <Section className="reference-section">
        <PageHeader
          eyebrow="Extensions"
          title="用扩展承载领域，而不是修改底座"
          description="每个扩展可以同时贡献 Server、Worker、Migration、Admin、Web、SEO、Sitemap 和受控 Landing Block。"
        />
        <div className="reference-extension-grid">
          {extensionSurfaces.map(([title, copy, ExtensionIcon]) => (
            <article key={title}>
              <ExtensionIcon size={18} />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="reference-cta-row">
          <Button asChild trailingIcon={<ArrowRight size={15} />}>
            <a href="/docs/extension-development">开始扩展开发</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/docs/domain-extension">查看领域扩展示例</a>
          </Button>
        </div>
      </Section>
    </OfficialSite>
  );
}

export function ReleasesPage({ presentation }: { presentation: PublicPresentation | null }) {
  return (
    <OfficialSite presentation={presentation}>
      <SeoHead canonicalPath="/releases" presentation={presentation} title="Frame Releases" />
      <Section className="reference-section">
        <PageHeader
          eyebrow="Releases"
          title="稳定地升级基础能力"
          description="Frame 当前以内部 tarball 验收为主，版本化包、迁移协议和 Consumer 验收先于公共 Registry 发布。"
        />
        <div className="reference-release">
          <div>
            <span className="reference-release__version">{FRAME_VERSION}</span>
            <div>
              <p className="reference-kicker">Current preview</p>
              <h2>Frame 0.7</h2>
              <p>
                完成 Core、Admin/Web Shell、系统信息、CMS 默认体验和 Reference Experience R0-R6
                产品化。
              </p>
            </div>
          </div>
          <ul>
            {[
              '公开 Package Contracts',
              'Defined System 组合',
              'Migration V2 与 Legacy Alias',
              'CMS Admin/Web 默认页面',
              '官方站与部署烟雾验收',
            ].map((item) => (
              <li key={item}>
                <Check size={16} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="reference-release-note">
          <GitBranch size={18} />
          <p>R6 已建立官方站和发布验收边界；下一步以真实 Consumer 迁移和线上数据验证包契约。</p>
        </div>
      </Section>
    </OfficialSite>
  );
}
