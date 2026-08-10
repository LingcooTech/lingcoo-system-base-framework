import { defineWebExtension } from '@lingcootech/frame-web';

function DomainHomePage() {
  return (
    <main className="domain-page">
      <p>Built with Lingcoo Frame</p>
      <h1>__DISPLAY_NAME__</h1>
      <p>从这个最小垂直切片开始实现公开站点业务。</p>
    </main>
  );
}

export const domainWebExtension = defineWebExtension({
  routes: [{ id: 'domain.home', component: DomainHomePage }],
  seo: [
    {
      id: 'domain.home',
      resolve: () => ({
        title: '__DISPLAY_NAME__',
        description: '__DISPLAY_NAME__',
        canonicalPath: '/',
      }),
    },
  ],
  sitemap: [{ id: 'domain.home', collect: () => [{ path: '/', priority: 1 }] }],
});
