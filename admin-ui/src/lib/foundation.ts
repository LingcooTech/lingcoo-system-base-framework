import { Gauge, PlugZap, Settings2, ShieldCheck, Waypoints, type LucideIcon } from 'lucide-react';

export type SectionKey = 'dashboard' | 'modules' | 'access' | 'integrations' | 'settings';

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
      { label: '内置模块', value: '4', note: 'system · auth · access · integrations' },
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
      { label: '配置方式', value: 'Environment', note: '运行配置由环境注入' },
      { label: '数据基础', value: 'PostgreSQL', note: 'Drizzle 管理 schema 和迁移' },
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
