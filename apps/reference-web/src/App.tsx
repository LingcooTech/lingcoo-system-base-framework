import { ArrowRight, Boxes, Braces, Database, Layers3, ShieldCheck } from 'lucide-react';
import { Button } from '@lingcoo/frame-ui/button';
import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcoo/frame-extension-sdk';
import { createCmsWebClient, createCmsWebExtension } from '@lingcoo/frame-cms/web';
import { cmsManifest } from '@lingcoo/frame-cms/contracts';
import { projectExtensionManifest } from '@lingcoo/frame-extension-sdk';
import {
  createWebRegistry,
  defineWebExtension,
  WebRouteSlot,
  WebShell,
  type WebRouteContext,
} from '@lingcoo/frame-web';
import { PublicAuthFlow, publicAuthModeFromRoute } from '@lingcoo/frame-web/account';
import { Hero, Section } from '@lingcoo/frame-web/layout';
import { frameWebManifest } from '@lingcoo/frame-web/manifest';
import { type PublicPresentation, usePublicPresentation } from '@lingcoo/frame-web/presentation';
import { SeoHead } from '@lingcoo/frame-web/seo';
import { SiteShell } from '@lingcoo/frame-web/site';
import { SystemPage } from '@lingcoo/frame-web/system-states';

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
  const mode = publicAuthModeFromRoute(params.mode);
  return mode ? (
    <PublicAuthFlow mode={mode} presentation={context.presentation} />
  ) : (
    <SystemPage kind="404" presentation={context.presentation} />
  );
}

const frameWebSurface = defineWebExtension<PublicWebContext>({
  routes: [
    { id: 'frame.auth', component: AuthRoute },
    { id: 'frame.home', component: HomeRoute },
  ],
  seo: [
    {
      id: 'frame.home',
      resolve() {
        return { canonicalPath: '/' };
      },
    },
  ],
  sitemap: [
    {
      id: 'frame.home',
      collect() {
        return [{ path: '/', changeFrequency: 'weekly', priority: 1 }];
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

const cmsWebDefinition = defineExtension({
  manifest: projectExtensionManifest(cmsManifest, ['web']),
  web: createCmsWebExtension<PublicWebContext>({
    client: createCmsWebClient((path, init) => fetch(path, init)),
    resolvePresentation: (context) => context.presentation,
  }),
});

const publicWebSystem = defineSystem({
  id: 'frame-reference-web',
  version: FRAME_VERSION,
  extensions: [frameWebDefinition, cmsWebDefinition],
});

const webRegistry = createWebRegistry<PublicWebContext>(publicWebSystem);

function App() {
  const { presentation } = usePublicPresentation();

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
