'use client';

import { SquareTerminal, Timer } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/Button';
import { CHECKPOINT_MINUTES, TEST_OUT_MINUTES } from '@/core/practice';
import type { MasteryState } from '@/core/mastery';
import { useOverview } from '@/features/catalog/useOverview';

export interface PractisePart {
  id: string;
  number: number;
  title: string;
  concepts: string[];
}

export interface PractiseAssessment {
  id: string;
  title: string;
  href: string;
  minutes: number;
}

const STARTED: ReadonlySet<MasteryState> = new Set([
  'introduced',
  'practised',
  'solid',
  'fluent',
  'gap',
]);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Below the one button: practice sorted into the same seven parts as Learn, each with what
 * needs review and a way to check the whole part, and the timed mock tests together. A
 * part with nothing started stays one quiet line.
 */
export function PractiseOverview({
  parts,
  assessments,
}: {
  parts: PractisePart[];
  assessments: PractiseAssessment[];
}) {
  const { view } = useOverview();
  const byId = new Map(view?.concepts.map((c) => [c.id, c]));

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-8 md:grid-cols-12">
      <section
        aria-labelledby="by-part-title"
        className="col-span-4 flex flex-col gap-2 md:col-span-12 lg:col-span-8"
      >
        <div className="flex flex-col gap-0.5">
          <p className="t-label">Check one stretch</p>
          <h2 id="by-part-title" className="t-section">
            Practise by part
          </h2>
          <p className="text-muted prose-measure text-sm">
            The session above already picks for you. A checkpoint mixes one part, weakest first; a
            test-out lets you skip a part you know.
          </p>
        </div>
        <ol className="rule-b flex flex-col">
          {parts.map((part) => {
            const started = part.concepts.filter((id) =>
              STARTED.has(byId.get(id)?.state ?? 'unseen'),
            ).length;
            const review = part.concepts.filter((id) => {
              const c = byId.get(id);
              return c?.state === 'gap' || (c?.dueNow ?? false);
            }).length;
            return (
              <li
                key={part.id}
                className="rule-t flex flex-wrap items-center gap-x-2 gap-y-1 py-2 sm:gap-x-4"
                data-testid="practise-part"
              >
                <span className="t-figure text-faint w-3 shrink-0 text-sm">{pad(part.number)}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="font-medium">{part.title}</h3>
                  <p className="t-label t-figure">
                    {!view ? (
                      '··'
                    ) : started === 0 ? (
                      'Not started'
                    ) : (
                      <>
                        <span className="text-fg">
                          {started}/{part.concepts.length}
                        </span>{' '}
                        started
                        {review > 0 ? (
                          <span className="text-accent"> · {review} to review</span>
                        ) : null}
                      </>
                    )}
                  </p>
                </div>
                <p className="flex w-full gap-1 pl-5 sm:w-auto sm:pl-0">
                  <Link
                    href={`/practise/checkpoint/${part.id}`}
                    aria-label={`Checkpoint ${CHECKPOINT_MINUTES} min, ${part.title}`}
                    className={buttonClass('secondary', 'md', 'flex-1 sm:flex-none')}
                  >
                    Checkpoint
                    <span className="t-figure text-muted">{CHECKPOINT_MINUTES} min</span>
                  </Link>
                  <Link
                    href={`/practise/test-out/${part.id}`}
                    aria-label={`Test out ${TEST_OUT_MINUTES} min, ${part.title}`}
                    className={buttonClass('quiet', 'md', 'flex-1 sm:flex-none')}
                  >
                    Test out
                    <span className="t-figure text-muted">{TEST_OUT_MINUTES} min</span>
                  </Link>
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {assessments.length > 0 ? (
        <section
          aria-labelledby="assessments-title"
          className="col-span-4 flex flex-col gap-2 md:col-span-12 lg:col-span-4"
        >
          <div className="flex flex-col gap-0.5">
            <p className="t-label">Rehearse the real thing</p>
            <h2 id="assessments-title" className="t-section">
              Timed assessments
            </h2>
            <p className="text-muted prose-measure text-sm">
              Timed tests in the AI-assisted coding simulator, with guided mode. The levelled mock runs as a lesson.
            </p>
          </div>
          <ul className="rule-b flex flex-col">
            <li className="rule-t">
              <Link
                href="/practise/online-test"
                className="group hover:bg-surface flex min-h-6 items-center gap-2 py-2 transition-colors duration-150 ease-out"
              >
                <SquareTerminal aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
                <span className="group-hover:text-accent min-w-0 flex-1 font-medium transition-colors duration-150 ease-out">
                  AI-assisted coding simulator
                </span>
                <span className="t-figure text-muted shrink-0 text-sm">9 tests · 30 tasks</span>
              </Link>
            </li>
            {assessments.map((a) => (
              <li key={a.id} className="rule-t">
                <Link
                  href={a.href}
                  className="group hover:bg-surface flex min-h-6 items-center gap-2 py-2 transition-colors duration-150 ease-out"
                >
                  <Timer aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
                  <span className="group-hover:text-accent min-w-0 flex-1 font-medium transition-colors duration-150 ease-out">
                    {a.title}
                  </span>
                  <span className="t-figure text-muted shrink-0 text-sm">{a.minutes} min</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
