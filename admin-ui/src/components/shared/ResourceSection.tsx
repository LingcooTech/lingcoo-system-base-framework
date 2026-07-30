import type { ReactNode } from 'react';

export function ResourceSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="resource-section">
      <header>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}
