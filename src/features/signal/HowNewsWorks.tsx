'use client';

import { Info, X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { SourceGroup } from '@/lib/news/sources';

interface HowNewsWorksProps {
  /** The page title. The info button sits on its last line. */
  children: ReactNode;
  groups: SourceGroup[];
}

const iconButton =
  'text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 shrink-0 items-center justify-center transition-press active:scale-98';

/**
 * Where the stories come from and how a day is picked, one tap away and out of the way
 * otherwise. A disclosure rather than a popover, so it reads the same on a phone, where a
 * forty-name list would not fit a floating box. Escape closes it and hands focus back.
 */
export function HowNewsWorks({ children, groups }: HowNewsWorksProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const feedCount = groups.reduce((sum, group) => sum + group.sources.length, 0);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="flex items-end gap-1">
        {children}
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label="How News works"
          title="How News works"
          onClick={() => setOpen((value) => !value)}
          className={cn(iconButton, 'mb-0.5', open && 'text-fg bg-raised')}
        >
          <Info aria-hidden size={20} strokeWidth={2} />
        </button>
      </div>

      {open ? (
        <section
          id={panelId}
          aria-label="How News works"
          className="rule-t rule-b step-in flex flex-col gap-4 py-3"
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-medium">Where stories come from</h2>
              <p className="text-muted">
                Hacker News stories of the last day with more than 100 points, new arXiv papers in
                software engineering, AI, machine learning, language, distributed systems, databases
                and human-computer interaction, and the {feedCount} feeds below.
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="font-medium">How a day is picked</h2>
              <p className="text-muted">
                The job runs every morning at 05:30 UTC. Stories older than three days are dropped,
                and copies of one story (the same link, or a near-identical headline) become one.
                Each is scored on its topics, how trusted the source is, points and comments, and
                age. The 12 highest make the edition, at most 4 on one topic and 5 from one source,
                and nothing shown in the last two weeks.
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="font-medium">How the briefs are written</h2>
              <p className="text-muted">
                A model writes a brief from the headline and the source&apos;s own short
                description, never the article, and each brief is checked before it is kept. Those
                are marked AI-summarised. Otherwise the brief is put together from the source&apos;s
                description and a glossary, and says nothing that is not in them.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="t-label">Feeds</h2>
            <div className="columns-2 gap-x-4 text-sm md:columns-3 lg:columns-4">
              {groups.map((group) => (
                <div key={group.name} className="break-inside-avoid pb-2">
                  <h3 className="font-medium">{group.name}</h3>
                  <ul className="text-muted">
                    {group.sources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="text-muted hover:text-fg rounded-control transition-press inline-flex h-5 items-center gap-0.5 self-start text-sm font-medium active:scale-98"
          >
            <X aria-hidden size={16} strokeWidth={2} />
            Close
          </button>
        </section>
      ) : null}
    </div>
  );
}
