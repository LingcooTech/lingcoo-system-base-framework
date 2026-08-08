import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { defineExtension, defineSystem } from '@lingcoo/frame-extension-sdk';

import { AdminShell, createAdminRegistry, defineAdminExtension } from '../src/index.js';
import { AdminAuthProvider, type AdminAccount, type AdminAuthClient } from '../src/auth.js';
import { AdminApplicationShell } from '../src/layout.js';
import { frameAdminManifest } from '../src/manifest.js';
import { AdminRouterProvider } from '../src/router.js';
import { DataTable, PageFrame } from '../src/shared.js';
import {
  AdminSystemInfoPage,
  type AdminSystemInfoClient,
  type AdminSystemRuntimeSummary,
} from '../src/system-info.js';

const account: AdminAccount = {
  id: 'account-1',
  email: 'owner@example.test',
  displayName: 'Owner',
  avatarUrl: null,
  mustChangePassword: false,
  roles: [{ code: 'owner', name: 'Owner' }],
  permissions: ['admin.access', 'system.runtime.read', 'notifications.read', 'search.use'],
};

const authClient: AdminAuthClient = {
  async getCurrentAccount() {
    return account;
  },
  async login() {
    return account;
  },
  async logout() {},
  async changePassword() {},
};

const extension = defineExtension({
  manifest: {
    id: 'example',
    version: '1.0.0',
    apiVersion: '1',
    frame: '^0.6.0',
    admin: {
      routes: [
        {
          id: 'example.dashboard',
          path: '/',
          title: '业务首页',
          permission: 'admin.access',
        },
      ],
      navigation: [
        {
          id: 'example.dashboard',
          routeId: 'example.dashboard',
          href: '/',
          label: '业务首页',
          group: '业务',
        },
      ],
    },
  },
  admin: defineAdminExtension({
    routes: [{ id: 'example.dashboard', component: () => <p>Dashboard</p> }],
    navigation: [{ id: 'example.dashboard' }],
  }),
});

const registry = createAdminRegistry(
  defineSystem({ id: 'admin-test', version: '0.6.0', extensions: [extension] }),
);

function installWindow() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { pathname: '/admin/', search: '' },
      history: { pushState() {} },
      localStorage: {
        getItem() {
          return null;
        },
        setItem() {},
      },
    },
  });
}

test('application shell keeps business navigation primary and Frame identity in the footer', () => {
  installWindow();
  const markup = renderToStaticMarkup(
    <AdminShell registry={registry}>
      <AdminAuthProvider client={authClient} initialAccount={account}>
        <AdminRouterProvider>
          <AdminApplicationShell
            context={{}}
            frame={{
              name: 'Lingcoo Frame',
              version: '0.6.0',
              systemInfoHref: '/system',
              systemInfoPermission: 'system.runtime.read',
            }}
          >
            <p>Business content</p>
          </AdminApplicationShell>
        </AdminRouterProvider>
      </AdminAuthProvider>
    </AdminShell>,
  );

  assert.match(markup, /应用后台导航/);
  assert.match(markup, /业务首页/);
  assert.match(markup, /Owner的账号菜单/);
  assert.match(markup, /本系统基于 Lingcoo Frame 构建 · v0\.6\.0/);
  assert.doesNotMatch(markup, /模块扩展/);
});

test('Frame keeps technical routes hidden and contributes one application settings entry', () => {
  assert.equal(
    frameAdminManifest.routes.some((route) => route.path === '/'),
    false,
  );
  assert.deepEqual(
    frameAdminManifest.navigation.map((item) => ({ id: item.id, label: item.label })),
    [{ id: 'frame.settings', label: '应用设置' }],
  );

  const hiddenRouteIds = [
    'frame.system-info',
    'frame.assets',
    'frame.operations',
    'frame.observability',
    'frame.notifications',
    'frame.audit',
  ];
  const routeIds = new Set(frameAdminManifest.routes.map((route) => route.id));
  const navigationRouteIds = new Set(frameAdminManifest.navigation.map((item) => item.routeId));
  for (const routeId of hiddenRouteIds) {
    assert.equal(routeIds.has(routeId), true);
    assert.equal(navigationRouteIds.has(routeId), false);
  }
});

test('shared page and table composites carry structure without application APIs', () => {
  const markup = renderToStaticMarkup(
    <PageFrame section={{ group: '业务', title: '客户', description: '客户资料' }}>
      <DataTable
        columns={[
          { key: 'name', header: '名称', cell: (row: { id: string; name: string }) => row.name },
        ]}
        getRowKey={(row) => row.id}
        rows={[{ id: '1', name: 'Acme' }]}
      />
    </PageFrame>,
  );

  assert.match(markup, /客户资料/);
  assert.match(markup, /Acme/);
  assert.doesNotMatch(markup, /NO DOMAIN MODULES/);
});

const runtimeSummary: AdminSystemRuntimeSummary = {
  name: 'Reference System',
  version: '0.1.0',
  environment: 'test',
  surfaces: ['api', 'worker', 'admin-ui', 'public-web'],
  system: { id: 'reference-system', version: '0.1.0' },
  frame: { version: '0.6.0', apiVersion: '1' },
  extensions: [
    {
      id: 'frame',
      version: '0.6.0',
      surfaces: ['server', 'worker', 'migrations', 'admin', 'web'],
      contributions: {
        permissions: 20,
        settings: 5,
        serverRoutes: 0,
        jobs: 3,
        subscriptions: 1,
        migrations: 10,
        adminRoutes: 14,
        webRoutes: 9,
      },
    },
  ],
  migrations: {
    status: 'current',
    declaredCount: 10,
    appliedCount: 10,
    pendingCount: 0,
    ledgerCount: 10,
    sources: [
      {
        id: 'frame',
        extensionId: 'frame',
        declaredCount: 10,
        appliedCount: 10,
        pendingCount: 0,
      },
    ],
  },
};

const systemInfoClient: AdminSystemInfoClient = {
  async loadRuntime() {
    return runtimeSummary;
  },
};

test('system information product renders installed extensions, migrations and protected areas', () => {
  installWindow();
  const markup = renderToStaticMarkup(
    <AdminRouterProvider>
      <AdminSystemInfoPage
        canReadObservability
        canReadOperations
        client={systemInfoClient}
        initialObservability={{
          runtime: {
            startedAt: new Date(0).toISOString(),
            uptimeSeconds: 3600,
            activeRequests: 0,
            requestCount: 12,
            errorCount: 0,
            errorRate: 0,
            averageDurationMs: 4,
            p95DurationMs: 8,
            memoryRssBytes: 64 * 1024 * 1024,
            heapUsedBytes: 32 * 1024 * 1024,
          },
          incidents: { open: 0, resolved: 1 },
          services: [],
          database: { status: 'healthy', latencyMs: 2 },
          metricsEndpointEnabled: true,
        }}
        initialOperations={{ jobs: { pending: 2, dead: 0 }, outboxTotal: 7 }}
        initialRuntime={runtimeSummary}
        managementLinks={[
          {
            href: '/observability',
            title: '运行诊断',
            description: '查看运行详情',
          },
        ]}
      />
    </AdminRouterProvider>,
  );

  assert.match(markup, /reference-system/);
  assert.match(markup, /Extension API 1/);
  assert.match(markup, /数据库迁移/);
  assert.match(markup, /10\/10/);
  assert.match(markup, /任务与事件/);
  assert.match(markup, /Outbox 事件/);
  assert.match(markup, /运行诊断/);
});

test('system information product hides protected diagnostics without permission', () => {
  installWindow();
  const markup = renderToStaticMarkup(
    <AdminRouterProvider>
      <AdminSystemInfoPage client={systemInfoClient} initialRuntime={runtimeSummary} />
    </AdminRouterProvider>,
  );

  assert.match(markup, /受权限保护/);
  assert.doesNotMatch(markup, /运行诊断/);
  assert.doesNotMatch(markup, /Outbox 事件/);
});
