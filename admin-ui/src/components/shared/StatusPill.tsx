import { Badge, type BadgeTone } from '@lingcoo/frame-ui/badge';

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export function StatusPill({ tone, children }: { tone: StatusTone; children: string }) {
  const badgeTone: BadgeTone = tone === 'ok' ? 'success' : tone === 'warn' ? 'warning' : tone;
  return (
    <Badge dot tone={badgeTone}>
      {children}
    </Badge>
  );
}
