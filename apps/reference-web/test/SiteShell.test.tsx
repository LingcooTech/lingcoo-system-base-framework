import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Hero, PageHeader, Section } from '../src/components/site/Layout';
import { SiteShell, type PublicPresentation } from '../src/components/site/SiteShell';

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

test('site shell renders brand-driven desktop, mobile and footer navigation', () => {
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
  assert.match(markup, /class="public-container public-container--wide public-hero__layout"/);
  assert.match(markup, /public-section--raised/);
  assert.match(markup, /public-container--content/);
  assert.match(markup, /class="public-page-header/);
});
