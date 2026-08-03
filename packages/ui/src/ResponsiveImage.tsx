import { forwardRef, type CSSProperties, type ImgHTMLAttributes } from 'react';

import { cx } from './lib/cx';

export interface ResponsiveImageSource {
  srcSet: string;
  media?: string;
  type?: string;
  sizes?: string;
}

export interface ResponsiveImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  sources?: ResponsiveImageSource[];
  aspectRatio?: CSSProperties['aspectRatio'];
  fit?: 'cover' | 'contain';
  wrapperClassName?: string;
}

export const ResponsiveImage = forwardRef<HTMLImageElement, ResponsiveImageProps>(
  (
    {
      alt,
      aspectRatio,
      className,
      fit = 'cover',
      loading = 'lazy',
      sources = [],
      wrapperClassName,
      ...rest
    },
    ref,
  ) => (
    <picture
      className={cx('lc-responsive-image', wrapperClassName)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {sources.map((source) => (
        <source
          key={`${source.media ?? 'all'}-${source.type ?? 'auto'}-${source.srcSet}`}
          media={source.media}
          sizes={source.sizes}
          srcSet={source.srcSet}
          type={source.type}
        />
      ))}
      <img
        ref={ref}
        alt={alt}
        className={cx('lc-responsive-image__img', `lc-responsive-image__img--${fit}`, className)}
        loading={loading}
        {...rest}
      />
    </picture>
  ),
);
ResponsiveImage.displayName = 'ResponsiveImage';
