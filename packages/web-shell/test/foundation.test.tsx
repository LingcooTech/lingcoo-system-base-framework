import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { publicAuthModeFromRoute } from '../src/account.js';
import { Hero, PageHeader, Section } from '../src/layout.js';
import type { PublicPresentation } from '../src/presentation.js';
import { breadcrumbStructuredData } from '../src/seo.js';
import { SiteShell } from '../src/site.js';
import { frameIdentityWebManifest, frameKernelWebManifest } from '../src/manifest.js';

Object.assign(globalThis, { React });

const presentation: PublicPresentation = {
  displayName: 'Frame Test',
  shortName: 'FT',
  slogan: 'Stable foundation',
  fullLogoAssetId: null,
  squareLogoAssetId: null,
  darkLogoAssetId: null,
  faviconAssetId: null,
  socialImageAssetId: null,
  primaryColor: '#315f47',
  secondaryColor: '#b9efc5',
  accentColor: '#39735a',
  contactEmail: 'hello@example.test',
  contactPhone: null,
  contactAddress: 'Shanghai',
  publicUrl: 'https://frame.example.test',
  seoTitle: 'Frame',
  seoDescription: 'Frame foundation',
  headerNavigation: [{ label: '文章', href: '/articles' }],
  footerLinks: [{ label: '隐私', href: '/pages/privacy' }],
  footerCopyright: 'Frame Test Copyright',
  filingInfo: 'Test ICP',
  assets: {},
};

test('site shell renders brand-driven navigation and footer content', () => {
  const markup = renderToStaticMarkup(
    <SiteShell headerOverlay headerTone="dark" presentation={presentation}>
      <section>Page body</section>
    </SiteShell>,
  );

  assert.match(markup, /Frame Test/);
  assert.match(markup, /Stable foundation/);
  assert.match(markup, /aria-label="主要导航"/);
  assert.match(markup, /href="\/articles"/);
  assert.match(markup, /aria-label="打开站点导航"/);
  assert.match(markup, /href="\/pages\/privacy"/);
  assert.match(markup, /mailto:hello@example.test/);
  assert.match(markup, /Frame Test Copyright/);
  assert.match(markup, /Test ICP/);
  assert.match(markup, /id="main-content"/);
});

test('site shell can omit its application admin entry', () => {
  const markup = renderToStaticMarkup(
    <SiteShell adminHref={null} presentation={presentation}>
      Content
    </SiteShell>,
  );
  assert.doesNotMatch(markup, /管理后台/);
});

test('site shell accepts application-owned navigation fallbacks', () => {
  const markup = renderToStaticMarkup(
    <SiteShell
      footerLinks={[{ label: '版本', href: '/releases' }]}
      headerNavigation={[{ label: '文档', href: '/docs' }]}
      presentation={presentation}
    >
      Content
    </SiteShell>,
  );
  assert.match(markup, /href="\/docs"/);
  assert.match(markup, /href="\/releases"/);
  assert.doesNotMatch(markup, /href="\/articles"/);
  assert.doesNotMatch(markup, /href="\/pages\/privacy"/);
});

test('layout primitives compose page structure without business semantics', () => {
  const markup = renderToStaticMarkup(
    <>
      <Hero description="Description" eyebrow="Foundation" title="Title" />
      <Section containerSize="content" tone="raised">
        <PageHeader description="Summary" eyebrow="Content" title="Article" />
      </Section>
    </>,
  );

  assert.match(markup, /class="public-hero"/);
  assert.match(markup, /public-container--wide public-hero__layout/);
  assert.match(markup, /public-section--raised/);
  assert.match(markup, /public-container--content/);
  assert.match(markup, /class="public-page-header/);
});

test('SEO helpers and public account routes are application-independent', () => {
  const data = breadcrumbStructuredData('https://example.test', [
    { href: '/', label: '首页' },
    { href: '/articles', label: '文章' },
    { label: '详情' },
  ]);
  const items = data.itemListElement as Record<string, unknown>[];
  assert.equal(items[1]?.item, 'https://example.test/articles');
  assert.equal(items[2]?.position, 3);
  assert.equal(publicAuthModeFromRoute('forgot-password'), 'forgot');
  assert.equal(publicAuthModeFromRoute('accept-invitation'), 'invitation');
  assert.equal(publicAuthModeFromRoute('unknown'), null);
});

test('public account route belongs to the optional Identity Web manifest', () => {
  assert.deepEqual(frameKernelWebManifest, {});
  assert.deepEqual(frameIdentityWebManifest.routes, [{ id: 'frame.auth', path: '/auth/:mode' }]);
});
