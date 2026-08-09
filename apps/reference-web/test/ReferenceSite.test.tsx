import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicPresentation } from '@lingcootech/frame-web/presentation';

import { officialSitemapEntries, referenceSiteManifest } from '../src/site/manifest';
import { HomePage } from '../src/site/pages';

Object.assign(globalThis, { React });

const presentation: PublicPresentation = {
  displayName: 'Lingcoo Frame',
  shortName: 'Frame',
  slogan: 'Foundation first. Domain follows.',
  fullLogoAssetId: null,
  squareLogoAssetId: null,
  darkLogoAssetId: null,
  faviconAssetId: null,
  socialImageAssetId: null,
  primaryColor: '#23684e',
  secondaryColor: '#bfe8c9',
  accentColor: '#d76550',
  contactEmail: null,
  contactPhone: null,
  contactAddress: null,
  publicUrl: 'https://frame.lingcoo.com',
  seoTitle: null,
  seoDescription: null,
  headerNavigation: [],
  footerLinks: [],
  footerCopyright: null,
  filingInfo: null,
  assets: {},
};

test('Reference Web declares the complete official-site route surface', () => {
  const routeIds = new Map(referenceSiteManifest.routes.map((route) => [route.path, route.id]));
  assert.equal(routeIds.get('/'), 'reference.home');
  assert.equal(routeIds.get('/framework'), 'reference.framework');
  assert.equal(routeIds.get('/architecture'), 'reference.architecture');
  assert.equal(routeIds.get('/packages'), 'reference.packages');
  assert.equal(routeIds.get('/extensions'), 'reference.extensions');
  assert.equal(routeIds.get('/docs'), 'reference.docs');
  assert.equal(routeIds.get('/docs/:slug'), 'reference.docs.detail');
  assert.equal(routeIds.get('/releases'), 'reference.releases');
});

test('Reference Web contributes public static Sitemap entries', () => {
  const paths = officialSitemapEntries.map((entry) => entry.path);
  assert.ok(paths.includes('/'));
  assert.ok(paths.includes('/framework'));
  assert.ok(paths.includes('/docs'));
  assert.ok(!paths.includes('/admin/'));
});

test('official homepage renders product boundary and application fallbacks', () => {
  const markup = renderToStaticMarkup(<HomePage presentation={presentation} />);
  assert.match(markup, /Lingcoo Frame/);
  assert.match(markup, /为轻量、自有、快速部署的行业系统/);
  assert.match(markup, /href="\/framework"/);
  assert.match(markup, /href="\/docs"/);
  assert.match(markup, /href="\/admin\/"/);
  assert.match(markup, /Reference Console/);
});
