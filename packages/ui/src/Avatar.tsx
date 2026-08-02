import * as RadixAvatar from '@radix-ui/react-avatar';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import { cx } from './lib/cx';

export const Avatar = forwardRef<
  HTMLSpanElement,
  ComponentPropsWithoutRef<typeof RadixAvatar.Root> & { size?: 'sm' | 'md' | 'lg' }
>(({ className, size = 'md', ...rest }, ref) => (
  <RadixAvatar.Root
    ref={ref}
    className={cx('lc-avatar', `lc-avatar--${size}`, className)}
    {...rest}
  />
));
Avatar.displayName = 'Avatar';

export const AvatarImage = forwardRef<
  HTMLImageElement,
  ComponentPropsWithoutRef<typeof RadixAvatar.Image>
>(({ className, ...rest }, ref) => (
  <RadixAvatar.Image ref={ref} className={cx('lc-avatar__image', className)} {...rest} />
));
AvatarImage.displayName = 'AvatarImage';

export const AvatarFallback = forwardRef<
  HTMLSpanElement,
  ComponentPropsWithoutRef<typeof RadixAvatar.Fallback>
>(({ className, ...rest }, ref) => (
  <RadixAvatar.Fallback ref={ref} className={cx('lc-avatar__fallback', className)} {...rest} />
));
AvatarFallback.displayName = 'AvatarFallback';
