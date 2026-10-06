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
import { rowAction, rowArrow, rowItem, rowList } from '@/components/ui/rows';
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

/**
 * A topic as a hairline row that toggles. The marker on the left carries the state, the
 * count on the right says why the topic is worth picking today.
 */
function TopicRow({
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
    <li className={rowItem}>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className={rowAction('py-1')}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-2 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ease-out',
            pressed ? 'bg-fg border-fg text-bg' : 'border-border-strong group-hover:border-fg',
          )}
        >
          {pressed ? <Check size={12} strokeWidth={3} /> : null}
        </span>
        <span className={cn('min-w-0 flex-1', pressed ? 'font-semibold' : 'font-medium')}>
          {label}
        </span>
        <span className="t-figure text-muted shrink-0 text-sm">{meta}</span>
      </button>
    </li>
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

  const chosen = preview?.topics ?? topics;
  const names =
    chosen.length === 0 || chosen.length === INTERESTS.length
      ? 'Every topic'
      : chosen.map(topicLabel).join(', ');

  return (
    <div className="flex max-w-5xl flex-col gap-6 md:pt-2">
      <header className="flex flex-col gap-1">
        <h1 className="t-title" data-arrive="title">
          What do you want to practise today?
        </h1>
        <p data-arrive="rise" className="text-muted text-lg">
          What you are about to forget comes first.
        </p>
      </header>

      <section
        aria-label="Today's practice"
        data-arrive="rise"
        className="bg-surface border-border rounded-panel shadow-edge flex flex-col gap-3 border p-2 md:p-3"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5" aria-live="polite">
            {count === 0 ? (
              <>
                <p className="text-lg font-semibold">Nothing to practise here yet</p>
                <p className="text-muted text-sm">Take a lesson in these topics first.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">
                  <span className="t-figure">{count}</span> {count === 1 ? 'question' : 'questions'}
                  {due > 0 ? (
                    <span className="text-muted font-normal">
                      , <span className="t-figure">{due}</span> due first
                    </span>
                  ) : null}
                </p>
                <p className="text-muted truncate text-sm">{names}</p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented
              label="Length"
              hideLabel
              options={LENGTHS}
              value={length}
              onChange={setLength}
              className="sm:w-30"
            />
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
        </div>
      </section>

      <section aria-labelledby="topics-title" className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="topics-title" className="t-section">
            Topics
          </h2>
          <p className="text-muted">Pick one or more, or practise everything.</p>
        </div>
        <div role="group" aria-labelledby="topics-title">
          <ul className={rowList()}>
          <TopicRow
            pressed={topics.length === 0}
            onClick={() => setPicked([])}
            label="Everything"
            meta={allDue > 0 ? `${allDue} due` : ''}
          />
          {INTERESTS.map((id) => (
            <TopicRow
              key={id}
              pressed={topics.includes(id)}
              onClick={() => toggle(id)}
              label={topicLabel(id)}
              meta={counts ? metaOf(counts[id]) : ''}
            />
          ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="tests-title" className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="tests-title" className="t-section">
            Tests
          </h2>
          <p className="text-muted">Against the clock, or one whole part at a time.</p>
        </div>
        <ul className={rowList('items-start')}>
          <li className={rowItem}>
            <Link href="/practise/online-test" className={rowAction()}>
              <Timer aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">Timed coding tests</span>
                <span className="text-muted text-sm">A clock, hidden tests and a report</span>
              </span>
              <ArrowRight aria-hidden size={16} strokeWidth={2} className={rowArrow} />
            </Link>
          </li>
          <li className={rowItem}>
            <details className="group/part">
              <summary className={rowAction('cursor-pointer list-none')}>
                <ListChecks aria-hidden size={20} strokeWidth={2} className="text-muted shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">Check one part</span>
                  <span className="text-muted text-sm">A checkpoint, or test out of it</span>
                </span>
                <ChevronDown
                  aria-hidden
                  size={16}
                  strokeWidth={2}
                  className="text-faint group-hover:text-fg shrink-0 transition duration-150 ease-out group-open/part:rotate-180"
                />
              </summary>
              <ol className="flex flex-col pb-1">
                {parts.map((part) => (
                  <li
                    key={part.id}
                    data-testid="practise-part"
                    className="rule-t flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 py-0.5"
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
          </li>
        </ul>
      </section>
    </div>
  );
}
