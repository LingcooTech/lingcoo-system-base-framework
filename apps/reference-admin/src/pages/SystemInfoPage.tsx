import { CircleHelp, Images, ListChecks, MonitorCog } from 'lucide-react';

import { useAdminAuth } from '@lingcoo/frame-admin/auth';
import {
  AdminSystemInfoPage,
  type AdminSystemInfoClient,
  type AdminSystemManagementLink,
} from '@lingcoo/frame-admin/system-info';

import {
  fetchObservabilitySummary,
  fetchRuntime,
  fetchSystemOperationsSummary,
} from '../api/client';

const systemInfoClient: AdminSystemInfoClient = {
  loadRuntime: fetchRuntime,
  loadObservability: fetchObservabilitySummary,
  loadOperations: fetchSystemOperationsSummary,
};

const managementLinks = [
  {
    href: '/operations',
    icon: ListChecks,
    title: '任务与事件',
    description: '查看后台任务、重试状态与 Outbox 事件。',
    permission: 'jobs.read',
  },
  {
    href: '/observability',
    icon: MonitorCog,
    title: '运行诊断',
    description: '查看请求指标、服务心跳和异常详情。',
    permission: 'observability.read',
  },
  {
    href: '/assets',
    icon: Images,
    title: '资产管理',
    description: '直接检查文件身份、存储对象和引用关系。',
    permission: 'assets.read',
  },
  {
    href: '/help',
    icon: CircleHelp,
    title: 'Frame 帮助',
    description: '查看框架能力边界、扩展约束和控制面。',
    permission: 'admin.access',
  },
] as const;

export function SystemInfoPage() {
  const { hasPermission } = useAdminAuth();
  const visibleLinks: AdminSystemManagementLink[] = managementLinks
    .filter((link) => hasPermission(link.permission))
    .map((link) => ({
      href: link.href,
      icon: link.icon,
      title: link.title,
      description: link.description,
    }));

  return (
    <AdminSystemInfoPage
      canReadObservability={hasPermission('observability.read')}
      canReadOperations={hasPermission('jobs.read')}
      client={systemInfoClient}
      managementLinks={visibleLinks}
    />
  );
}
