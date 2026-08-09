import { defineAdminExtension } from '@lingcootech/frame-admin';
import { createElement, type ChangeEvent } from 'react';

function ExampleAdminPage() {
  return createElement(
    'section',
    { 'aria-labelledby': 'example-admin-title', style: { padding: '32px' } },
    createElement('p', null, 'Frame Extension'),
    createElement('h1', { id: 'example-admin-title' }, '示例扩展后台页面'),
    createElement('p', null, '这个页面由扩展的独立 Admin 入口注册，宿主没有增加中心路由分支。'),
  );
}

function ExampleDashboardWidget() {
  return createElement(
    'article',
    { 'aria-label': '示例扩展状态', style: { padding: '20px', border: '1px solid #d9dee7' } },
    createElement('strong', null, 'Example extension'),
    createElement('p', null, 'Admin、Web 与 Landing Block 运行面已注册。'),
  );
}

function ExampleHeroEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange(value: unknown): void;
}) {
  const title =
    typeof value === 'object' && value && 'title' in value && typeof value.title === 'string'
      ? value.title
      : '';
  return createElement('input', {
    'aria-label': '主视觉标题',
    value: title,
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      onChange({
        ...(typeof value === 'object' && value ? value : {}),
        title: event.currentTarget.value,
      }),
  });
}

export const exampleAdminExtension = defineAdminExtension({
  routes: [{ id: 'example.overview', component: ExampleAdminPage }],
  navigation: [{ id: 'example.overview' }],
  dashboardWidgets: [{ id: 'example.summary', component: ExampleDashboardWidget }],
  searchProviders: [
    {
      id: 'example.content',
      async search({ query }) {
        if (!'示例扩展'.toLowerCase().includes(query.toLowerCase())) return [];
        return [
          {
            id: 'example',
            label: '示例扩展',
            items: [{ id: 'overview', title: '示例扩展', href: '/example', kind: 'Extension' }],
          },
        ];
      },
    },
  ],
  landingBlockEditors: [{ type: 'example.hero', component: ExampleHeroEditor }],
});
