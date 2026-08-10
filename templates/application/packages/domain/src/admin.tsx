import { defineAdminExtension } from '@lingcootech/frame-admin';

function DomainOverviewPage() {
  return (
    <main className="app-message">
      <p>Frame Consumer</p>
      <h1>__DISPLAY_NAME__</h1>
      <p>这是由业务扩展贡献的后台首页，可以从这里开始实现领域功能。</p>
    </main>
  );
}

export const domainAdminExtension = defineAdminExtension({
  routes: [{ id: 'domain.overview', component: DomainOverviewPage }],
  navigation: [{ id: 'domain.overview' }],
});
