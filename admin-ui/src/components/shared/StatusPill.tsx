export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export function StatusPill({ tone, children }: { tone: StatusTone; children: string }) {
  return (
    <span className={`pill pill-${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
