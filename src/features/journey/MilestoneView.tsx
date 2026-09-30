'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Figure } from '@/components/ui/Figure';
import { ProgressLine } from '@/components/ui/ProgressLine';
import {
  adrEntry,
  explanationsFrom,
  milestoneMarkdown,
  partProgress,
  type PartIndex,
} from '@/core/insight';
import type { MasteryState } from '@/core/mastery';
import { upcast } from '@/core/progress';
import { useOverview } from '@/features/catalog/useOverview';
import { localDateOf } from '@/features/store/progress-store';
import { useProgress, useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { downloadText } from '@/lib/download';
import { CapstoneEntry } from './CapstoneEntry';
import { Title } from '@/features/motion/Title';

export interface MilestonePart {
  id: string;
  number: number;
  title: string;
  summary: string;
  capstone: { title: string; brief: string };
  lessons: string[];
  lessonTitles: Record<string, string>;
  canBuild: { module: string; youCanBuild: string }[];
  concepts: { id: string; title: string }[];
}

const STATE_STYLE: Record<MasteryState, string> = {
  unseen: 'text-faint font-normal',
  assumed: 'text-muted font-normal',
  introduced: 'text-muted font-normal',
  practised: 'text-fg font-normal',
  solid: 'text-fg font-medium',
  fluent: 'text-fg font-semibold',
  gap: 'text-accent font-medium',
};

/**
 * The end of a part. It says what the learner can now do, shows where the part's concepts
 * stand today, and hands over a Markdown file to keep. It informs and stops: one primary
 * action, "Done", and nothing moves on by itself.
 */
export function MilestoneView({ part }: { part: MilestonePart }) {
  const store = useStore();
  const { status, state } = useProgress();
  const { view } = useOverview();
  const [exporting, setExporting] = useState(false);

  const index: PartIndex = {
    id: part.id,
    title: part.title,
    summary: part.summary,
    modules: [],
    lessons: part.lessons,
    concepts: part.concepts.map((c) => c.id),
  };
  const states = new Map(view?.concepts.map((c) => [c.id, c.state]));
  const stateOf = (id: string): MasteryState => states.get(id) ?? 'unseen';
  const progress = partProgress(index, state, stateOf);
  const practised = part.concepts.filter((c) =>
    ['practised', 'introduced'].includes(stateOf(c.id)),
  ).length;
  const gaps = part.concepts.filter((c) => stateOf(c.id) === 'gap');

  async function exportMarkdown() {
    setExporting(true);
    try {
      const file = await store.exportFile();
      const notes = explanationsFrom(file.events.map(upcast), part.lessons).map((note) => ({
        lesson: part.lessonTitles[note.lessonId] ?? note.lessonId,
        text: note.text,
      }));
      const markdown = milestoneMarkdown({
        title: part.title,
        summary: part.summary,
        date: localDateOf(new Date()),
        canBuild: part.canBuild,
        capstone: part.capstone,
        concepts: part.concepts.map((c) => ({ title: c.title, state: stateOf(c.id) })),
        notes,
        adr: adrEntry(state, part, part.number),
      });
      downloadText(`understory-${part.id}.md`, markdown);
    } finally {
      setExporting(false);
    }
  }

  const left = progress.lessonsTotal - progress.lessonsDone;

  return (
    <div className="bg-bg text-fg flex min-h-dvh flex-col">
      <main id="content" className="frame flex-1 pt-6 pb-20">
        <section aria-labelledby="milestone-title" className="flex max-w-4xl flex-col gap-6">
          <header className="step-in flex flex-col gap-2">
            <p className="t-label">
              Milestone · Part{' '}
              <span className="t-figure">{String(part.number).padStart(2, '0')}</span>
            </p>
            <Title id="milestone-title" wait={status !== 'ready'}>
              {status !== 'ready' ? (
                `${part.title}.`
              ) : progress.complete ? (
                <>
                  {part.title}. <span className="text-muted">Complete.</span>
                </>
              ) : (
                <>
                  {part.title}.{' '}
                  <span className="text-muted">
                    {left} {left === 1 ? 'lesson' : 'lessons'} to go.
                  </span>
                </>
              )}
            </Title>
            <ProgressLine
              value={progress.lessonShare}
              label={`${progress.lessonsDone} of ${progress.lessonsTotal} lessons done`}
              className="max-w-lg"
            />
          </header>

          <section aria-labelledby="can-now" className="flex flex-col gap-2">
            <h2 id="can-now" className="t-label rule-t pt-2">
              What you can now do
            </h2>
            <p className="prose-measure text-lg">{part.summary}</p>
            <ul className="flex flex-col gap-1">
              {part.canBuild.map((line) => (
                <li key={line.module} className="prose-measure">
                  <span className="font-medium">{line.module}.</span>{' '}
                  <span className="text-muted">{line.youCanBuild}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="mastery" className="flex flex-col gap-2">
            <h2 id="mastery" className="t-label rule-t pt-2">
              Where the part stands today
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
              <Figure
                label="Solid or better"
                value={String(progress.conceptsSolid)}
                unit={`/ ${progress.conceptsTotal}`}
              />
              <Figure label="Practised" value={String(practised)} />
              <Figure
                label="Gaps"
                value={String(gaps.length)}
                tone={gaps.length > 0 ? 'gap' : 'default'}
                note={
                  gaps.length > 0
                    ? gaps
                        .slice(0, 2)
                        .map((c) => c.title)
                        .join(', ')
                    : undefined
                }
              />
              <Figure
                label="Lessons"
                value={String(progress.lessonsDone)}
                unit={`/ ${progress.lessonsTotal}`}
              />
            </dl>
            <details className="rule-b">
              <summary className="t-label flex min-h-5 cursor-pointer items-center">
                All {part.concepts.length} concepts
              </summary>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 pb-2 text-sm">
                {part.concepts.map((c) => (
                  <li key={c.id} className={cn(STATE_STYLE[stateOf(c.id)])}>
                    {c.title}
                  </li>
                ))}
              </ul>
            </details>
            <p className="text-muted prose-measure text-sm">
              Memory fades, so these numbers will too. The checkpoint brings a part back in ten
              minutes.
            </p>
          </section>

          <section aria-labelledby="keep" className="flex flex-col gap-2">
            <h2 id="keep" className="t-label rule-t pt-2">
              Build and keep
            </h2>
            <ul className="flex flex-col">
              <li>
                <CapstoneEntry
                  partId={part.id}
                  partNumber={part.number}
                  capstone={part.capstone}
                  open
                />
              </li>
            </ul>
            <p className="text-muted prose-measure text-sm">
              The Markdown file holds the brief, your decision record, where each concept stands,
              and every explanation you wrote in this part. Keep it with the project as a record of
              the work.
            </p>
            <div className="flex flex-wrap gap-1">
              <Link href="/" className={buttonClass('primary')}>
                Done
              </Link>
              <Button
                variant="quiet"
                onClick={() => void exportMarkdown()}
                loading={exporting}
                disabled={status !== 'ready'}
              >
                <Download aria-hidden size={16} strokeWidth={2} />
                Download as Markdown
              </Button>
              {status !== 'ready' || progress.complete ? null : (
                <Link href={`/learn#part-${part.id}`} className={buttonClass('quiet')}>
                  See the lessons
                </Link>
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
