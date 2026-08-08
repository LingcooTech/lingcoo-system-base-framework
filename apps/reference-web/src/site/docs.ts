export interface ReferenceDocumentMetadata {
  slug: string;
  title: string;
  section: 'Start' | 'Architecture' | 'Capabilities' | 'Operations';
  summary: string;
}

export interface ReferenceDocument extends ReferenceDocumentMetadata {
  body: string;
}

const sources = import.meta.glob('../../../../docs/*.md', {
  import: 'default',
  query: '?raw',
}) as Record<string, () => Promise<string>>;

export const referenceDocuments: ReferenceDocumentMetadata[] = [
  {
    slug: 'architecture',
    title: '架构说明',
    section: 'Architecture',
    summary: '从宿主、运行时、扩展和前端入口理解 Frame 的整体边界。',
  },
  {
    slug: 'platform-roadmap',
    title: '平台改造路线',
    section: 'Start',
    summary: '了解从源码项目到可安装、可升级平台的演进阶段。',
  },
  {
    slug: 'extension-development',
    title: '扩展开发与系统组合',
    section: 'Start',
    summary: '用一个 Defined System 将 API、Worker、Admin 和 Web 组合在一起。',
  },
  {
    slug: 'domain-extension',
    title: '领域扩展指南',
    section: 'Start',
    summary: '从模块边界开始开发教育、零售或其他领域能力。',
  },
  {
    slug: 'package-contracts',
    title: 'Package Contracts',
    section: 'Architecture',
    summary: '查看每个公开包的职责、入口和独立安装契约。',
  },
  {
    slug: 'frontend-foundation',
    title: '双 Web 前端与共享组件',
    section: 'Architecture',
    summary: '理解公共 Web、Admin Shell、UI、CMS 和品牌呈现的分工。',
  },
  {
    slug: 'capability-matrix',
    title: '能力矩阵',
    section: 'Capabilities',
    summary: '按运行面查看 Frame 自带能力和 Consumer 需要开发的部分。',
  },
  {
    slug: 'identity-access',
    title: '身份与访问控制',
    section: 'Capabilities',
    summary: '账号、会话、RBAC、权限和认证边界。',
  },
  {
    slug: 'account-security',
    title: '账号自服务与安全中心',
    section: 'Capabilities',
    summary: '个人资料、密码、会话、邀请和邮箱验证流程。',
  },
  {
    slug: 'cms-lite',
    title: '轻量内容中心',
    section: 'Capabilities',
    summary: '页面、文章、版本、SEO、重定向和计划发布。',
  },
  {
    slug: 'presentation',
    title: '品牌与站点呈现',
    section: 'Capabilities',
    summary: '品牌设置、导航、Logo、联系方式和公开站点壳。',
  },
  {
    slug: 'media-assets',
    title: '文件与媒体资产中心',
    section: 'Capabilities',
    summary: '上传意图、对象复核、引用保护和异步删除。',
  },
  {
    slug: 'integration-foundation',
    title: '外部集成基础',
    section: 'Capabilities',
    summary: 'Provider、Connection、凭据和调用审计。',
  },
  {
    slug: 'shared-providers',
    title: '通用 Provider 适配器',
    section: 'Capabilities',
    summary: 'SMTP、对象存储、支付和 AI Provider 的公共约束。',
  },
  {
    slug: 'jobs-notifications',
    title: '后台任务、Outbox 与通知',
    section: 'Operations',
    summary: '持久化任务、可靠事件、重试和通知投递。',
  },
  {
    slug: 'observability',
    title: '运行可观测性',
    section: 'Operations',
    summary: 'Request ID、日志、心跳、指标和异常聚合。',
  },
  {
    slug: 'metadata-search-exchange',
    title: '元数据、统一搜索与数据交换',
    section: 'Operations',
    summary: '字典、分类、搜索 Provider 和版本化数据集。',
  },
  {
    slug: 'settings-audit',
    title: '设置与审计',
    section: 'Operations',
    summary: '类型化设置、版本历史和审计事件。',
  },
  {
    slug: 'reference-experience-roadmap',
    title: '官方站与参考应用路线',
    section: 'Operations',
    summary: 'frame.lingcoo.com 的产品边界和 R0-R6 实施记录。',
  },
];

function normalizeMarkdownLinks(markdown: string) {
  return markdown.replace(
    /\]\((?!https?:\/\/|mailto:|#|\/)([^)]+\.md)(?:#[^)]*)?\)/g,
    (_match, file) => `](/docs/${String(file).replace(/^\.\//, '').replace(/\.md$/, '')})`,
  );
}

export async function loadReferenceDocument(slug: string): Promise<ReferenceDocument | null> {
  const metadata = referenceDocuments.find((document) => document.slug === slug);
  const load = sources[`../../../../docs/${slug}.md`];
  if (!metadata || !load) return null;
  return { ...metadata, body: normalizeMarkdownLinks(await load()) };
}
