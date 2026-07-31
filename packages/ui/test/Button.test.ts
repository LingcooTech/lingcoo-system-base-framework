import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '../src/Button';

test('asChild button composes icons into the slotted link', () => {
  const markup = renderToStaticMarkup(
    createElement(
      Button,
      {
        asChild: true,
        leadingIcon: createElement('span', { 'data-icon': 'leading' }),
        trailingIcon: createElement('span', { 'data-icon': 'trailing' }),
      },
      createElement('a', { href: '/admin/' }, '查看管理后台'),
    ),
  );

  assert.match(markup, /^<a /);
  assert.match(markup, /href="\/admin\/"/);
  assert.match(markup, /data-icon="leading"/);
  assert.match(markup, /查看管理后台/);
  assert.match(markup, /data-icon="trailing"/);
});
