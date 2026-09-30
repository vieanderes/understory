'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Ledger, PageHead } from '@/components/layout/PageHead';
import { buttonClass } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useOverview } from '@/features/catalog/useOverview';
import { Title } from '@/features/motion/Title';

const LENGTHS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '20', label: '20 min' },
  { value: '45', label: '45 min' },
] as const;

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

/** About 1.4 items a minute (LEARNING-SCIENCE B2). Shown so the learner knows the size first. */
const itemsFor = (minutes: number) => Math.round(minutes * 1.4);

/** What the queue does, in its own order, so the mix is never a mystery. */
const RECIPE = [
  { title: 'Fading first', note: 'What you are about to forget, lowest recall first.' },
  { title: 'Weakest two, mixed', note: 'Your two weakest concepts, interleaved on purpose.' },
  { title: 'One probe', note: 'A check on something assumed, to keep the map honest.' },
] as const;

/**
 * A session is sized before it starts and ends on its own. The learner picks the length;
 * the queue picks the content: what is about to be forgotten first, then the two weakest
 * concepts interleaved, then one probe.
 */
export function PractisePanel() {
  const { view } = useOverview();
  const [minutes, setMinutes] = useState<(typeof LENGTHS)[number]['value']>('10');
  const due = view?.due.dueNow ?? 0;
  const started = view?.due.started ?? 0;
  const value = (n: number | undefined) => (view ? (n ?? 0) : '··');

  // On a phone the figures follow the session, so the button is on the first screen.
  const ledger = (
    <Ledger
      rows={[
        { label: 'Due now', value: value(due) },
        {
          label: 'Nearly forgotten',
          value: value(view?.due.nearlyForgotten),
          gap: (view?.due.nearlyForgotten ?? 0) > 0,
        },
        { label: 'On a schedule', value: value(started) },
        { label: 'Gaps', value: value(view?.gaps.length), gap: (view?.gaps.length ?? 0) > 0 },
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        label="Practise"
        title={
          <Title wait={!view}>
            {!view ? (
              'Practise'
            ) : started === 0 ? (
              <>
                Nothing to practise yet. <span className="text-muted">Cards start in lessons.</span>
              </>
            ) : due > 0 ? (
              <>
                <span className="t-figure">{due}</span> due.{' '}
                <span className="text-muted">Lowest recall first.</span>
              </>
            ) : (
              <>
                Nothing due.{' '}
                <span className="text-muted">
                  {view.due.nextDue ? `Next: ${DAY.format(new Date(view.due.nextDue))}.` : ''}
                </span>
              </>
            )}
          </Title>
        }
        lede="Mixed practice feels harder than one topic at a time, and teaches more. Pick a length; the queue picks the rest."
        aside={ledger}
        asideClassName="hidden md:flex"
      />

      <section
        aria-labelledby="session-title"
        data-arrive="rise"
        className="bg-surface border-border rounded-panel grid grid-cols-4 gap-x-4 gap-y-3 border p-2 sm:p-3 md:grid-cols-12 md:gap-y-4 md:p-4"
      >
        <div className="col-span-4 flex min-w-0 flex-col gap-3 md:col-span-5 lg:col-span-4">
          <div className="flex flex-col gap-0.5">
            <p className="t-label">Today</p>
            <h2 id="session-title" className="t-section">
              One mixed session
            </h2>
          </div>
          <Segmented label="Length" options={LENGTHS} value={minutes} onChange={setMinutes} />
          {started === 0 && view ? (
            <Link href="/learn" className={buttonClass('primary', 'lg', 'w-full')}>
              Go to lessons
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          ) : (
            <Link
              href={`/practise/session/${minutes}`}
              className={buttonClass('primary', 'lg', 'w-full')}
            >
              Start · about {itemsFor(Number(minutes))} items
              <ArrowRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          )}
        </div>
        <ol
          aria-label="What a session holds"
          className="col-span-4 grid grid-cols-1 gap-x-4 md:col-span-7 md:self-end lg:col-span-8 lg:grid-cols-3"
        >
          {RECIPE.map((step, i) => (
            <li key={step.title} className="rule-t flex gap-2 py-2 lg:flex-col lg:gap-0.5">
              <span className="t-figure text-faint w-3 shrink-0 text-sm">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{step.title}</span>
                <span className="text-muted text-sm">{step.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <div className="md:hidden">{ledger}</div>
    </div>
  );
}
