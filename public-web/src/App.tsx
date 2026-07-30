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
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Lingcoo Base Framework 首页">
          <span className="brand-mark">L</span>
          <span>
            <strong>Lingcoo Base</strong>
            <small>System Framework</small>
          </span>
        </a>
        <nav aria-label="主要导航">
          <a href="#architecture">基础架构</a>
          <a href="/health">运行状态</a>
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
          <strong>Lingcoo Base Framework</strong>
        </div>
        <p>Foundation first. Domain follows.</p>
      </footer>
    </main>
  );
}

export default App;
