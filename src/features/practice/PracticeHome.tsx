'use client';

import { ArrowRight, Check, ChevronRight, Timer } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHead } from '@/components/layout/PageHead';
import { buttonClass } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import {
  buildSession,
  CHECKPOINT_MINUTES,
  sessionSize,
  TEST_OUT_MINUTES,
  type SessionMinutes,
} from '@/core/practice';
import { INTERESTS, type Interest } from '@/core/profile/interests';
import { useCatalog } from '@/features/catalog/useCatalog';
import { Title } from '@/features/motion/Title';
import { useProgress } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { currentDevice } from './device';
import { defaultTopics, sessionHref, topicLabel } from './topics';

export interface PracticePart {
  id: string;
  number: number;
  title: string;
}

const LENGTHS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '20', label: '20 min' },
] as const;
type Length = (typeof LENGTHS)[number]['value'];

const CHIP = cn(
  'rounded-full inline-flex h-5 items-center gap-0.5 border px-2 text-sm font-medium select-none',
  'transition-press active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        CHIP,
        pressed
          ? 'bg-fg text-bg border-fg'
          : 'border-border text-muted hover:text-fg hover:border-border-strong',
      )}
    >
      {pressed ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

/**
 * Practice asks one question: what to practise today. Topics and a length, then one button.
 * The queue does the rest: due items first, then first looks at lessons not taken yet
 * (LEARNING-SCIENCE.md B2, "Practice by topic"). Tests and part checks stay one tap away.
 */
export function PracticeHome({ parts }: { parts: PracticePart[] }) {
  const { status, state } = useProgress();
  const { catalog } = useCatalog();
  const [picked, setPicked] = useState<readonly Interest[] | null>(null);
  const [length, setLength] = useState<Length>('10');
  const minutes = Number(length) as SessionMinutes;

  // Until the learner touches a chip, the choice follows the log as it loads.
  const ready = status === 'ready';
  const defaults = useMemo(() => (ready ? defaultTopics(state) : []), [ready, state]);
  const topics = picked ?? defaults;

  const preview = useMemo(() => {
    if (!catalog || !ready) return null;
    const build = (chosen: readonly Interest[]) =>
      buildSession({
        state,
        catalog,
        now: new Date(),
        minutes,
        device: currentDevice(),
        seed: 1,
        topics: chosen,
      });
    const session = build(topics);
    // "Everything" with little due and little started would be short: fill it from every
    // topic, which keeps the due items first and adds first looks at new lessons.
    if (topics.length > 0 || session.items.length >= sessionSize(minutes)) return { session, topics };
    return { session: build(INTERESTS), topics: INTERESTS };
  }, [catalog, ready, state, minutes, topics]);

  const count = preview?.session.items.length ?? sessionSize(minutes);
  const due = preview?.session.items.filter((i) => i.source === 'due').length ?? 0;
  const href = sessionHref(minutes, preview?.topics ?? topics);

  const toggle = (id: Interest) =>
    setPicked(topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id]);

  return (
    <div className="flex flex-col gap-6">
      <PageHead label="Practice" title={<Title>What do you want to practise today?</Title>} />

      <section
        aria-label="Today's practice"
        data-arrive="rise"
        className="bg-surface border-border rounded-panel grid grid-cols-4 gap-x-4 gap-y-4 border p-2 sm:p-3 md:grid-cols-12 md:p-4"
      >
        <fieldset className="col-span-4 flex min-w-0 flex-col gap-1 md:col-span-12 xl:col-span-8">
          <legend className="t-label pb-1">Topics</legend>
          <div className="flex flex-wrap gap-1">
            <Chip pressed={topics.length === 0} onClick={() => setPicked([])}>
              Everything
            </Chip>
            {INTERESTS.map((id) => (
              <Chip key={id} pressed={topics.includes(id)} onClick={() => toggle(id)}>
                {topicLabel(id)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="col-span-4 grid min-w-0 grid-cols-1 items-end gap-x-4 gap-y-2 md:col-span-12 lg:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Segmented label="Length" options={LENGTHS} value={length} onChange={setLength} />
          {count > 0 ? (
            <Link href={href} className={buttonClass('primary', 'lg', 'w-full')}>
              <span>
                Start · about <span className="t-figure">{count}</span>{' '}
                {count === 1 ? 'question' : 'questions'}
              </span>
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          ) : (
            <Link href="/learn" className={buttonClass('primary', 'lg', 'w-full')}>
              Go to lessons
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          )}
          <p className="text-muted text-sm empty:hidden lg:col-span-2 xl:col-span-1" aria-live="polite">
            {count === 0 ? (
              'Nothing to practise in these topics yet.'
            ) : due > 0 ? (
              <>
                <span className="t-figure text-fg">{due}</span> due, they come first.
              </>
            ) : null}
          </p>
        </div>
      </section>

      <ul aria-label="More practice" className="rule-b flex flex-col md:max-w-3xl">
        <li className="rule-t">
          <Link
            href="/practise/online-test"
            className="group flex min-h-6 items-center gap-2 py-1 transition-colors duration-150 ease-out"
          >
            <Timer aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
            <span className="group-hover:text-accent min-w-0 flex-1 font-medium transition-colors duration-150 ease-out">
              Sit a timed coding test
            </span>
            <ChevronRight aria-hidden size={16} strokeWidth={2} className="text-muted shrink-0" />
          </Link>
        </li>
        <li className="rule-t">
          <details className="group">
            <summary className="flex min-h-6 cursor-pointer list-none items-center gap-2 py-1 font-medium">
              <Check aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
              <span className="min-w-0 flex-1">Check one part</span>
              <ChevronRight
                aria-hidden
                size={16}
                strokeWidth={2}
                className="text-muted shrink-0 transition-transform duration-150 ease-out group-open:rotate-90"
              />
            </summary>
            <ol className="flex flex-col pb-1">
              {parts.map((part) => (
                <li
                  key={part.id}
                  data-testid="practise-part"
                  className="rule-t flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1 sm:pl-5"
                >
                  <span className="min-w-0 basis-full text-sm sm:flex-1 sm:basis-auto">
                    <span className="t-figure text-faint">{part.number}</span> {part.title}
                  </span>
                  <span className="-ml-2 flex gap-1 sm:ml-0">
                    <Link
                      href={`/practise/checkpoint/${part.id}`}
                      aria-label={`Checkpoint, ${CHECKPOINT_MINUTES} min, ${part.title}`}
                      className={buttonClass('quiet', 'md')}
                    >
                      Checkpoint
                      <span className="t-figure text-muted">{CHECKPOINT_MINUTES} min</span>
                    </Link>
                    <Link
                      href={`/practise/test-out/${part.id}`}
                      aria-label={`Test out, ${TEST_OUT_MINUTES} min, ${part.title}`}
                      className={buttonClass('quiet', 'md')}
                    >
                      Test out
                      <span className="t-figure text-muted">{TEST_OUT_MINUTES} min</span>
                    </Link>
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </li>
      </ul>
    </div>
  );
}
