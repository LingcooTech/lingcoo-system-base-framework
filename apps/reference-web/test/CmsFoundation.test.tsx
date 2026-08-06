import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ArticleCard } from '../src/components/cms/ArticleCard';
import { ContentDetail } from '../src/components/cms/ContentDetail';
import { ContentRenderer } from '../src/components/cms/ContentRenderer';
import { breadcrumbStructuredData } from '../src/components/site/seo-data';
import type { CmsContent } from '../src/types';

Object.assign(globalThis, { React });

const article: CmsContent = {
  id: 'article-1',
  type: 'article',
  slug: 'foundation-update',
  title: 'Foundation update',
  excerpt: 'A reusable content summary.',
  body: '## Details\n\n- Shared\n- Safe',
  coverAssetId: 'cover-1',
  socialImageAssetId: null,
  seoTitle: 'Foundation update',
  seoDescription: 'Foundation release details.',
  publishedAt: '2026-08-03T08:00:00.000Z',
  author: { displayName: 'Frame Editor' },
  terms: [{ id: 'term-1', name: 'Release', color: '#315f47' }],
  assets: { 'cover-1': { publicUrl: 'https://example.test/cover.jpg' } },
};

test('CMS components render article cards, safe Markdown and detail semantics', () => {
  const card = renderToStaticMarkup(<ArticleCard article={article} />);
  assert.match(card, /href="\/articles\/foundation-update"/);
  assert.match(card, /cover\.jpg/);
  assert.match(card, /Foundation update/);

  const markdown = renderToStaticMarkup(<ContentRenderer content={article.body} />);
  assert.match(markdown, /<h2>Details<\/h2>/);
  assert.match(markdown, /<li>Shared<\/li>/);

  const detail = renderToStaticMarkup(<ContentDetail content={article} presentation={null} />);
  assert.match(detail, /aria-label="面包屑导航"/);
  assert.match(detail, /Frame Editor/);
  assert.match(detail, /dateTime="2026-08-03T08:00:00.000Z"/);
  assert.match(detail, /Release/);
});

test('breadcrumb structured data maps labels, positions and absolute URLs', () => {
  const data = breadcrumbStructuredData('https://example.test', [
    { href: '/', label: '首页' },
    { href: '/articles', label: '文章' },
    { label: '详情' },
  ]);
  const items = data.itemListElement as Record<string, unknown>[];
  assert.equal(data['@type'], 'BreadcrumbList');
  assert.equal(items[1]?.item, 'https://example.test/articles');
  assert.equal(items[2]?.position, 3);
});
