import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Alert } from '../src/Alert';
import { Breadcrumb } from '../src/Breadcrumb';
import { Pagination } from '../src/Pagination';
import { ResponsiveImage } from '../src/ResponsiveImage';
import { SkeletonText } from '../src/Skeleton';

test('alert exposes semantic tone and an accessible role', () => {
  const markup = renderToStaticMarkup(
    createElement(Alert, { title: '保存失败', tone: 'danger' }, '请稍后重试'),
  );

  assert.match(markup, /class="lc-alert lc-alert--danger"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /保存失败/);
  assert.match(markup, /请稍后重试/);
});

test('breadcrumb and pagination expose current-page navigation semantics', () => {
  const breadcrumb = renderToStaticMarkup(
    createElement(Breadcrumb, {
      items: [
        { href: '/', label: '首页' },
        { href: '/articles', label: '文章' },
        { label: '基础框架' },
      ],
    }),
  );
  const pagination = renderToStaticMarkup(
    createElement(Pagination, {
      hrefForPage: (page: number) => `/articles?page=${page}`,
      page: 6,
      pageCount: 12,
    }),
  );

  assert.match(breadcrumb, /aria-label="面包屑导航"/);
  assert.match(breadcrumb, /aria-current="page"/);
  assert.match(pagination, /aria-label="分页导航"/);
  assert.match(pagination, /href="\/articles\?page=5"/);
  assert.match(pagination, /aria-current="page"/);
  assert.match(pagination, /lc-pagination__ellipsis/);
});

test('responsive image and skeleton primitives render stable loading markup', () => {
  const image = renderToStaticMarkup(
    createElement(ResponsiveImage, {
      alt: '封面',
      aspectRatio: '16 / 9',
      sources: [{ media: '(max-width: 640px)', srcSet: '/cover-small.webp' }],
      src: '/cover.webp',
    }),
  );
  const skeleton = renderToStaticMarkup(createElement(SkeletonText, { lines: 3 }));

  assert.match(image, /^<picture /);
  assert.match(image, /aspect-ratio:16 \/ 9/);
  assert.match(image, /srcSet="\/cover-small.webp"/);
  assert.match(image, /loading="lazy"/);
  assert.equal((skeleton.match(/lc-skeleton lc-skeleton--line/g) ?? []).length, 3);
});
