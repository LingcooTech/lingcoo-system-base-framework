import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cx } from './lib/cx';

const buttonVariants = cva('lc-button', {
  variants: {
    variant: {
      primary: 'lc-button--primary',
      secondary: 'lc-button--secondary',
      ghost: 'lc-button--ghost',
      danger: 'lc-button--danger',
      link: 'lc-button--link',
    },
    size: {
      sm: 'lc-button--sm',
      md: 'lc-button--md',
      lg: 'lc-button--lg',
    },
    block: {
      true: 'lc-button--block',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
    block: false,
  },
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild = false,
      block,
      children,
      className,
      disabled,
      leadingIcon,
      loading = false,
      size,
      trailingIcon,
      type,
      variant,
      ...rest
    },
    ref,
  ) => {
    const Component = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;
    return (
      <Component
        ref={ref}
        className={cx(buttonVariants({ block, size, variant }), className)}
        type={asChild ? undefined : (type ?? 'button')}
        disabled={asChild ? undefined : isDisabled}
        aria-disabled={asChild && isDisabled ? true : undefined}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <span aria-hidden className="lc-spinner lc-spinner--sm" /> : leadingIcon}
        <Slottable>{children}</Slottable>
        {trailingIcon}
      </Component>
    );
  },
);
Button.displayName = 'Button';
