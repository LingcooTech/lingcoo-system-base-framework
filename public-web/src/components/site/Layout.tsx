import { cx } from '@lingcoo/frame-ui';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'content' | 'wide' | 'full';
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = 'wide', ...rest }, ref) => (
    <div
      ref={ref}
      className={cx('public-container', `public-container--${size}`, className)}
      {...rest}
    />
  ),
);
Container.displayName = 'Container';

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  tone?: 'base' | 'raised' | 'dark' | 'brand';
  spacing?: 'sm' | 'md' | 'lg';
  containerSize?: ContainerProps['size'];
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  (
    { children, className, containerSize = 'wide', spacing = 'lg', tone = 'base', ...rest },
    ref,
  ) => (
    <section
      ref={ref}
      className={cx(
        'public-section',
        `public-section--${tone}`,
        `public-section--${spacing}`,
        className,
      )}
      {...rest}
    >
      <Container size={containerSize}>{children}</Container>
    </section>
  ),
);
Section.displayName = 'Section';

export function Hero({
  actions,
  aside,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  aside?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className="public-hero">
      <div aria-hidden className="public-hero__grid" />
      <Container className="public-hero__layout">
        <div className="public-hero__content">
          {eyebrow ? <div className="public-hero__eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {description ? <div className="public-hero__description">{description}</div> : null}
          {actions ? <div className="public-hero__actions">{actions}</div> : null}
        </div>
        {aside ? <div className="public-hero__aside">{aside}</div> : null}
      </Container>
    </section>
  );
}

export const PageHeader = forwardRef<
  HTMLElement,
  HTMLAttributes<HTMLElement> & {
    eyebrow?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    align?: 'left' | 'center';
  }
>(
  (
    { actions, align = 'left', className, description, eyebrow, meta, title, ...rest },
    ref,
  ) => (
    <header
      ref={ref}
      className={cx('public-page-header', `public-page-header--${align}`, className)}
      {...rest}
    >
      <div className="public-page-header__content">
        {eyebrow ? <p className="public-page-header__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <div className="public-page-header__description">{description}</div> : null}
        {meta ? <div className="public-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="public-page-header__actions">{actions}</div> : null}
    </header>
  ),
);
PageHeader.displayName = 'PageHeader';
