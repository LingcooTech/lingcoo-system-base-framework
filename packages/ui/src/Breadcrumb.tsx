import { Fragment, type ReactNode } from 'react';

import { cx } from './lib/cx';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

export function Breadcrumb({
  className,
  items,
  label = '面包屑导航',
  separator = '/',
}: {
  className?: string;
  items: BreadcrumbItem[];
  label?: string;
  separator?: ReactNode;
}) {
  return (
    <nav aria-label={label} className={cx('lc-breadcrumb', className)}>
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <Fragment key={`${String(item.label)}-${index}`}>
              <li>
                {item.href && !current ? (
                  <a href={item.href}>{item.label}</a>
                ) : (
                  <span aria-current={current ? 'page' : undefined}>{item.label}</span>
                )}
              </li>
              {!current ? (
                <li aria-hidden className="lc-breadcrumb__separator">
                  {separator}
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
