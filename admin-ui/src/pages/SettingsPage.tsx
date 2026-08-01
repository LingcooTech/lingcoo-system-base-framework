import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

export function SettingsPage() {
  return (
    <PageFrame section={sections.settings}>
      <ResourceSection title="基础能力" description="运行环境配置与管理后台配置保持明确边界。">
        <dl className="settings-list">
          <div>
            <dt>PostgreSQL</dt>
            <dd>
              <StatusPill tone="info">环境变量</StatusPill>
            </dd>
          </div>
          <div>
            <dt>认证与权限</dt>
            <dd>
              <StatusPill tone="ok">已启用</StatusPill>
            </dd>
          </div>
          <div>
            <dt>集成凭据</dt>
            <dd>
              <StatusPill tone="ok">加密存储</StatusPill>
            </dd>
          </div>
          <div>
            <dt>后台任务</dt>
            <dd>
              <StatusPill tone="ok">Worker 已启用</StatusPill>
            </dd>
          </div>
        </dl>
      </ResourceSection>
    </PageFrame>
  );
}
