import { ArrowRight, BookOpenText, Settings2 } from 'lucide-react';

import { AdminLink } from '@lingcoo/frame-admin/router';
import { PageFrame, ResourceSection } from '@lingcoo/frame-admin/shared';

const homeSection = {
  group: '应用',
  title: '参考应用',
  description: '这是一个保持轻量的 Frame Consumer，用于验证应用组合、内容管理和公共设置。',
};

const workspaces = [
  {
    href: '/cms',
    icon: BookOpenText,
    title: '内容管理',
    description: '管理参考站点的页面、文章、版本与发布状态。',
  },
  {
    href: '/settings',
    icon: Settings2,
    title: '应用设置',
    description: '管理成员、连接、品牌、数据基础和应用配置。',
  },
];

export function HomePage() {
  return (
    <PageFrame section={homeSection}>
      <ResourceSection title="工作区" description="选择当前需要处理的应用工作。">
        <div className="settings-hub-grid settings-hub-grid--compact">
          {workspaces.map(({ href, icon: Icon, title, description }) => (
            <AdminLink className="settings-hub-card" href={href} key={href}>
              <span className="settings-hub-card__icon">
                <Icon aria-hidden size={18} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowRight aria-hidden size={16} />
            </AdminLink>
          ))}
        </div>
      </ResourceSection>
    </PageFrame>
  );
}
