import type { ReactNode } from 'react';

import type { SectionMeta } from '../../lib/foundation';

export function PageFrame({ section, children }: { section: SectionMeta; children: ReactNode }) {
  return (
    <div className="page-frame">
      <section className="page-hero">
        <div>
          <p className="eyebrow">{section.group}</p>
          <h1>{section.title}</h1>
          <p className="page-lead">{section.description}</p>
        </div>
        <span className="framework-label">NO DOMAIN MODULES</span>
      </section>
      <div className="context-grid">
        {section.context.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.note}</p>
          </article>
        ))}
      </div>
      {children}
    </div>
  );
}
