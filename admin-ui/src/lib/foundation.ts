import {
  Activity,
  Bell,
  DatabaseZap,
  Gauge,
  Images,
  ListChecks,
  PlugZap,
  Palette,
  ScrollText,
  Settings2,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

export type SectionKey =
  | 'dashboard'
  | 'modules'
  | 'access'
  | 'integrations'
  | 'assets'
  | 'operations'
  | 'observability'
  | 'notifications'
  | 'metadata'
  | 'audit'
  | 'presentation'
  | 'settings';

export interface SectionMeta {
  id: SectionKey;
  group: string;
  title: string;
  navLabel: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission: string;
  context: [
    { label: string; value: string; note: string },
    { label: string; value: string; note: string },
  ];
}

export const sections: Record<SectionKey, SectionMeta> = {
  dashboard: {
    id: 'dashboard',
    group: '总览',
    title: '基础框架控制台',
    navLabel: '系统概览',
    description: '查看运行面、基础服务和框架扩展状态。',
    href: '/',
    icon: Gauge,
    permission: 'system.runtime.read',
    context: [
      { label: '框架阶段', value: 'Foundation', note: '尚未装载行业业务模块' },
      { label: '运行模式', value: 'Single image', note: 'API 同时托管双 Web 产物' },
    ],
  },
  modules: {
    id: 'modules',
    group: '架构',
    title: '领域模块',
    navLabel: '模块扩展',
    description: '所有具体业务都通过明确的领域模块进入系统。',
    href: '/modules',
    icon: Waypoints,
    permission: 'admin.access',
    context: [
      { label: '内置模块', value: '14', note: '含 presentation · search · data-exchange' },
      { label: '扩展目录', value: 'src/modules', note: '业务模块显式注册' },
    ],
  },
  access: {
    id: 'access',
    group: '系统',
    title: '身份与访问',
    navLabel: '身份与权限',
    description: '管理通用账号、会话、角色和资源权限。',
    href: '/access',
    icon: ShieldCheck,
    permission: 'iam.accounts.read',
    context: [
      { label: '会话方式', value: 'HttpOnly JWT', note: '数据库支持主动撤销' },
      { label: '权限模型', value: 'RBAC', note: '账号可同时拥有多个角色' },
    ],
  },
  integrations: {
    id: 'integrations',
    group: '系统',
    title: '外部集成',
    navLabel: '外部集成',
    description: '通过统一 Provider 契约管理服务配置、加密凭据、连通性和调用记录。',
    href: '/integrations',
    icon: PlugZap,
    permission: 'integrations.read',
    context: [
      { label: '凭据存储', value: 'AES-256-GCM', note: '密钥与普通配置物理分离' },
      { label: '接入方式', value: 'Provider', note: '服务适配器显式注册并版本化' },
    ],
  },
  assets: {
    id: 'assets',
    group: '资源',
    title: '媒体资产中心',
    navLabel: '媒体资源库',
    description: '统一管理文件身份、云存储对象、访问方式和领域引用关系。',
    href: '/assets',
    icon: Images,
    permission: 'assets.read',
    context: [
      { label: '资产身份', value: 'Asset ID', note: '领域不直接绑定对象 URL' },
      { label: '存储通道', value: 'Qiniu', note: '直传 · 复核 · 异步删除' },
    ],
  },
  operations: {
    id: 'operations',
    group: '运行',
    title: '任务与事件',
    navLabel: '任务中心',
    description: '查看持久化后台任务、重试状态和 Outbox 事件投影。',
    href: '/operations',
    icon: ListChecks,
    permission: 'jobs.read',
    context: [
      { label: '任务队列', value: 'PostgreSQL', note: '行锁领取 · 不丢失' },
      { label: '失败恢复', value: 'Backoff', note: '指数退避与人工重试' },
    ],
  },
  observability: {
    id: 'observability',
    group: '运行',
    title: '运行状态',
    navLabel: '运行监控',
    description: '查看 API、Worker、数据库、请求指标与聚合异常的实时状态。',
    href: '/observability',
    icon: Activity,
    permission: 'observability.read',
    context: [
      { label: '关联标识', value: 'Request ID', note: '贯穿响应 · 日志 · 审计 · 异常' },
      { label: '指标出口', value: 'Prometheus', note: '独立令牌保护 · 可按需启用' },
    ],
  },
  notifications: {
    id: 'notifications',
    group: '运行',
    title: '通知中心',
    navLabel: '通知中心',
    description: '管理站内通知、系统公告和异步邮件投递。',
    href: '/notifications',
    icon: Bell,
    permission: 'notifications.read',
    context: [
      { label: '站内状态', value: 'Inbox', note: '未读 · 已读 · 归档' },
      { label: '邮件投递', value: 'Async', note: 'SMTP Provider · Worker' },
    ],
  },
  metadata: {
    id: 'metadata',
    group: '数据',
    title: '通用数据基础',
    navLabel: '数据字典与分类',
    description: '管理非业务化的数据字典、分类法、标签和版本化数据交换。',
    href: '/metadata',
    icon: DatabaseZap,
    permission: 'metadata.read',
    context: [
      {
        label: '组织模型',
        value: 'Dictionary + Taxonomy',
        note: '稳定代码 · 可选层级 · 资源关联',
      },
      { label: '数据交换', value: 'Adapter', note: '版本化 JSON · 预检 · 原子 Upsert' },
    ],
  },
  audit: {
    id: 'audit',
    group: '系统',
    title: '审计中心',
    navLabel: '审计日志',
    description: '查询跨模块的关键操作记录、资源上下文和操作者。',
    href: '/audit',
    icon: ScrollText,
    permission: 'audit.read',
    context: [
      { label: '记录方式', value: 'Append only', note: '业务操作只追加审计事件' },
      { label: '查询维度', value: 'Structured', note: '动作 · 资源 · 操作者 · 时间' },
    ],
  },
  presentation: {
    id: 'presentation',
    group: '站点',
    title: '品牌与站点呈现',
    navLabel: '品牌设置',
    description: '统一管理系统标识、品牌色、联系方式和站点基础呈现。',
    href: '/presentation',
    icon: Palette,
    permission: 'presentation.read',
    context: [
      { label: '资源引用', value: 'Asset ID', note: 'Logo 与站点图片不绑定存储 URL' },
      { label: '发布方式', value: 'Public profile', note: '只公开安全的品牌呈现字段' },
    ],
  },
  settings: {
    id: 'settings',
    group: '系统',
    title: '框架设置',
    navLabel: '系统设置',
    description: '查看基础运行配置和后续系统能力的接入位置。',
    href: '/settings',
    icon: Settings2,
    permission: 'system.settings.read',
    context: [
      { label: '配置方式', value: 'Typed registry', note: '只允许登记过的非敏感设置' },
      { label: '变更历史', value: 'Versioned', note: '每次保存保留操作者与原因' },
    ],
  },
};

export const sectionList = Object.values(sections);

export function getSectionByPath(pathname: string): SectionMeta {
  return (
    sectionList
      .filter((section) => section.href !== '/' && pathname.startsWith(section.href))
      .sort((left, right) => right.href.length - left.href.length)[0] ?? sections.dashboard
  );
}
