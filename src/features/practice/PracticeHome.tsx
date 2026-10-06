'use client';

import { ArrowRight, Check, ChevronDown, ListChecks, Timer } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
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
import { topicCounts, type TopicCount } from '@/core/practice/topic-counts';
import { useCatalog } from '@/features/catalog/useCatalog';
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

/** A topic as a compact tile: its name and what it has waiting, on one line. */
function TopicTile({
  pressed,
  onClick,
  label,
  meta,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  meta: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-control transition-press flex min-h-5 items-center gap-1 border px-1.5 py-0.5 text-left select-none active:scale-98',
        'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
        pressed
          ? 'border-fg bg-raised text-fg'
          : 'border-border text-fg hover:border-border-strong hover:bg-raised',
      )}
    >
      {pressed ? (
        <Check aria-hidden size={16} strokeWidth={2} className="shrink-0" />
      ) : null}
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <span className="t-figure text-muted shrink-0 text-sm">{meta}</span>
    </button>
  );
}

const metaOf = ({ due, fresh }: TopicCount) =>
  due > 0 ? `${due} due` : fresh > 0 ? `${fresh} new` : '';

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

  const counts = useMemo(
    () => (catalog && ready ? topicCounts(state, catalog, new Date()) : null),
    [catalog, ready, state],
  );
  const allDue = counts ? INTERESTS.reduce((sum, id) => sum + counts[id].due, 0) : 0;

  const count = preview?.session.items.length ?? sessionSize(minutes);
  const due = preview?.session.items.filter((i) => i.source === 'due').length ?? 0;
  const href = sessionHref(minutes, preview?.topics ?? topics);

  const toggle = (id: Interest) =>
    setPicked(topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id]);

  return (
    <div className="flex max-w-3xl flex-col gap-6 md:pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="t-title" data-arrive="title">
          Practice
        </h1>
        <p data-arrive="rise" className="text-muted text-lg">
          Choose topics and a length. What you are about to forget comes first.
        </p>
      </header>

      <section aria-label="Today's practice" data-arrive="rise" className="flex flex-col gap-2">
        <div role="group" aria-labelledby="practise-title" className="flex flex-col gap-1">
          <h2 id="practise-title" className="font-semibold">
            Topics
          </h2>
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-3">
            <TopicTile
              pressed={topics.length === 0}
              onClick={() => setPicked([])}
              label="Everything"
              meta={allDue > 0 ? `${allDue} due` : ''}
            />
            {INTERESTS.map((id) => (
              <TopicTile
                key={id}
                pressed={topics.includes(id)}
                onClick={() => toggle(id)}
                label={topicLabel(id)}
                meta={counts ? metaOf(counts[id]) : ''}
              />
            ))}
          </div>
        </div>

        <div className="bg-surface border-border rounded-panel mt-1 flex flex-col gap-2 border p-2 sm:flex-row sm:items-center sm:gap-3">
          <Segmented
            label="Length"
            hideLabel
            options={LENGTHS}
            value={length}
            onChange={setLength}
            className="sm:w-30"
          />
          <p className="min-w-0 flex-1 text-sm" aria-live="polite">
            {count === 0 ? (
              <span className="text-muted">Nothing to practise in these topics yet.</span>
            ) : (
              <>
                <span className="t-figure font-medium">{count}</span>{' '}
                {count === 1 ? 'question' : 'questions'}
                <span className="text-muted">
                  {due > 0 ? `, ${due} due first` : ', with the answers explained'}
                </span>
              </>
            )}
          </p>
          {count > 0 ? (
            <Link href={href} className={buttonClass('primary', 'lg', 'shrink-0')}>
              Start
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          ) : (
            <Link href="/paths" className={buttonClass('primary', 'lg', 'shrink-0')}>
              Go to lessons
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <section className="border-border rounded-panel flex flex-col gap-2 border p-2 sm:p-3">
          <Timer aria-hidden size={24} strokeWidth={2} className="text-muted" />
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold">Timed coding tests</h2>
            <p className="text-muted text-sm">
              Sit a test like the real ones: a clock, hidden tests and a report afterwards.
            </p>
          </div>
          <Link
            href="/practise/online-test"
            className={buttonClass('secondary', 'md', 'mt-auto w-fit')}
          >
            Open coding tests
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        </section>

        <section className="border-border rounded-panel flex flex-col gap-2 border p-2 sm:p-3">
          <ListChecks aria-hidden size={24} strokeWidth={2} className="text-muted" />
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold">Check one part</h2>
            <p className="text-muted text-sm">
              A checkpoint mixes a whole part. A test-out lets you skip what you know.
            </p>
          </div>
          <details className="group mt-auto">
            <summary
              className={buttonClass('secondary', 'md', 'w-fit cursor-pointer list-none')}
            >
              Choose a part
              <ChevronDown
                aria-hidden
                size={16}
                strokeWidth={2}
                className="transition-transform duration-150 ease-out group-open:rotate-180"
              />
            </summary>
            <ol className="flex flex-col pt-2">
              {parts.map((part) => (
                <li
                  key={part.id}
                  data-testid="practise-part"
                  className="rule-t flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 py-1"
                >
                  <span className="min-w-0 text-sm">
                    <span className="t-figure text-faint">{part.number}</span> {part.title}
                  </span>
                  <span className="flex gap-0.5">
                    <Link
                      href={`/practise/checkpoint/${part.id}`}
                      aria-label={`Checkpoint, ${CHECKPOINT_MINUTES} min, ${part.title}`}
                      className={buttonClass('quiet', 'md')}
                    >
                      Checkpoint
                    </Link>
                    <Link
                      href={`/practise/test-out/${part.id}`}
                      aria-label={`Test out, ${TEST_OUT_MINUTES} min, ${part.title}`}
                      className={buttonClass('quiet', 'md')}
                    >
                      Test out
                    </Link>
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </section>
      </div>
    </div>
  );
}
