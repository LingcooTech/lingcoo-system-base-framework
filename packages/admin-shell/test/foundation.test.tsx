import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { defineExtension, defineSystem } from '@lingcoo/frame-extension-sdk';

import { AdminShell, createAdminRegistry, defineAdminExtension } from '../src/index.js';
import { AdminAuthProvider, type AdminAccount, type AdminAuthClient } from '../src/auth.js';
import { AdminApplicationShell } from '../src/layout.js';
import { AdminRouterProvider } from '../src/router.js';
import { DataTable, PageFrame } from '../src/shared.js';

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
