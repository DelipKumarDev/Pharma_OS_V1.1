import type { ReactNode } from 'react';

export interface LegalSection {
  heading: string;
  /** Paragraphs and/or bullet lists rendered in order. */
  body: Array<string | { list: string[] }>;
}

interface LegalDocProps {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}

/** Shared reading layout for the Privacy Policy and Terms of Service pages. */
export function LegalDoc({ title, updated, intro, sections }: LegalDocProps) {
  return (
    <article>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground sm:text-[32px]">{title}</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-4 text-[14px] leading-relaxed text-muted-foreground">{intro}</div>
      </header>

      <div className="space-y-8">
        {sections.map((section, i) => (
          <section key={section.heading}>
            <h2 className="text-[16px] font-semibold text-foreground">
              <span className="mr-2 text-muted-foreground">{i + 1}.</span>
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-muted-foreground">
              {section.body.map((block, j) =>
                typeof block === 'string' ? (
                  <p key={j}>{block}</p>
                ) : (
                  <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-border">
                    {block.list.map((item, k) => (
                      <li key={k}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-border bg-muted/40 p-4 text-[13px] leading-relaxed text-muted-foreground">
        Questions about this document? Contact us at{' '}
        <a href="mailto:support@z2infy.com" className="font-medium text-foreground underline underline-offset-2">
          support@z2infy.com
        </a>
        .
      </div>
    </article>
  );
}
