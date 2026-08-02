import * as RadixTooltip from '@radix-ui/react-tooltip';
import { type ReactNode } from 'react';

export const TooltipProvider = RadixTooltip.Provider;

export function Tooltip({
  children,
  content,
  side = 'right',
}: {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="lc-tooltip-content" side={side} sideOffset={8}>
          {content}
          <RadixTooltip.Arrow className="lc-tooltip-arrow" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
