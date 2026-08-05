import { defineLandingBlock, defineWebExtension, type JsonValue } from '@lingcoo/frame-web';
import { createElement } from 'react';
import { z } from 'zod';

const exampleHeroSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  imageAssetId: z.string().min(1).nullable().default(null),
});

const exampleHeroBlock = defineLandingBlock({
  type: 'example.hero',
  schemaVersion: 2,
  schema: exampleHeroSchema,
  renderer({ config, instanceId }) {
    return createElement(
      'section',
      { 'aria-labelledby': `${instanceId}-title`, 'data-landing-block': 'example.hero' },
      createElement('h2', { id: `${instanceId}-title` }, config.title),
      config.description ? createElement('p', null, config.description) : null,
    );
  },
  assets(config) {
    return config.imageAssetId ? [{ assetId: config.imageAssetId, role: 'background' }] : [];
  },
  migrations: [
    {
      from: 1,
      to: 2,
      migrate(config: JsonValue): JsonValue {
        if (!config || Array.isArray(config) || typeof config !== 'object') return config;
        return { description: '', imageAssetId: null, ...config };
      },
    },
  ],
});

function ExamplePublicPage() {
  return createElement(
    'main',
    { 'aria-labelledby': 'example-public-title', style: { padding: '48px' } },
    createElement('p', null, 'Frame Extension'),
    createElement('h1', { id: 'example-public-title' }, '示例扩展公共页面'),
    createElement('p', null, '该页面通过 Web Registry 注册，不依赖宿主的中心路由分支。'),
  );
}

export const exampleWebExtension = defineWebExtension({
  routes: [{ id: 'example.public', component: ExamplePublicPage }],
  seo: [
    {
      id: 'example.public',
      resolve() {
        return {
          title: '示例扩展',
          description: 'Frame 前端扩展运行面示例。',
          canonicalPath: '/example',
        };
      },
    },
  ],
  sitemap: [
    {
      id: 'example.public',
      collect() {
        return [{ path: '/example', changeFrequency: 'monthly', priority: 0.5 }];
      },
    },
  ],
  landingBlocks: [exampleHeroBlock],
});

export { exampleHeroBlock, exampleHeroSchema };
