import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

export function SettingsPage() {
  return (
    <PageFrame section={sections.settings}>
      <ResourceSection
        title="基础能力"
        description="当前阶段只展示接入状态，不提供虚假的配置保存。"
      >
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
            <dt>对象存储</dt>
            <dd>
              <StatusPill tone="neutral">未启用</StatusPill>
            </dd>
          </div>
          <div>
            <dt>后台任务</dt>
            <dd>
              <StatusPill tone="neutral">未启用</StatusPill>
            </dd>
          </div>
        </dl>
      </ResourceSection>
    </PageFrame>
  );
}
