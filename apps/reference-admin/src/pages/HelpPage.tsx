import { ArrowRight, Braces, Database, ExternalLink, ShieldCheck, Terminal } from 'lucide-react';

import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { sections } from '../lib/foundation';
import { Link } from '../lib/router';

const capabilityGroups = [
  {
    title: '系统基础',
    items: ['身份认证与 RBAC', '设置、审计与通知', '任务队列与 Outbox', '运行状态与指标'],
  },
  {
    title: '站点基础',
    items: ['品牌与公共导航', '媒体资产与安全访问', 'CMS Lite 与 SEO', '双 Web 应用壳'],
  },
  {
    title: '扩展基础',
    items: ['模块显式注册', '统一搜索与权限', 'Metadata 分类能力', 'Provider 外部集成'],
  },
];

const workflows = [
  {
    href: '/modules',
    icon: Braces,
    title: '接入领域模块',
    description: '从模块目录、权限、路由和搜索注册点检查扩展边界。',
  },
  {
    href: '/presentation',
    icon: ExternalLink,
    title: '配置公共站点',
    description: '维护品牌资源、顶部导航、页脚链接和搜索呈现。',
  },
  {
    href: '/cms',
    icon: Database,
    title: '发布通用内容',
    description: '创建页面或文章，预览 SEO，并即时或定时发布。',
  },
  {
    href: '/observability',
    icon: Terminal,
    title: '检查运行状态',
    description: '查看 API、Worker、数据库、请求指标和聚合异常。',
  },
];

export function HelpPage() {
  return (
    <PageFrame section={sections.help}>
      <ResourceSection
        title="能力地图"
        description="Frame 只承载跨行业稳定能力，课程、商品、订单等模型由领域模块拥有。"
      >
        <div className="help-capability-grid">
          {capabilityGroups.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>
                    <ShieldCheck aria-hidden size={15} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ResourceSection>

      <ResourceSection
        title="常用工作入口"
        description="按当前任务进入对应控制面，页面权限仍由账号角色决定。"
      >
        <div className="help-workflow-list">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Link href={workflow.href} key={workflow.href}>
                <Icon aria-hidden size={18} />
                <span>
                  <strong>{workflow.title}</strong>
                  <small>{workflow.description}</small>
                </span>
                <ArrowRight aria-hidden size={16} />
              </Link>
            );
          })}
        </div>
      </ResourceSection>

      <ResourceSection title="扩展约束" description="新增能力时保持这些系统边界稳定。">
        <div className="help-rules">
          <p>
            <strong>领域归属</strong>
            行业实体和业务流程进入独立模块，通用框架不反向依赖领域模块。
          </p>
          <p>
            <strong>资源引用</strong>
            业务表保存 Asset ID，不直接持久化云存储 URL 或供应商私有字段。
          </p>
          <p>
            <strong>外部服务</strong>
            第三方能力通过 Provider 契约接入，凭据与普通配置分离保存。
          </p>
          <p>
            <strong>可追踪性</strong>
            关键写操作写入审计，后台任务使用持久化队列并保留失败状态。
          </p>
        </div>
      </ResourceSection>
    </PageFrame>
  );
}
