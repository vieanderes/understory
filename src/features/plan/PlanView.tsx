'use client';

import { ArrowRight, Check, Circle, Flag, Repeat2, SquareTerminal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { InlineCode } from '@/components/ui/InlineCode';
import { ProgressLine } from '@/components/ui/ProgressLine';
import { itemDone, milestoneDone, type PlanCatalog, type PlanItem } from '@/core/plan';
import { useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { formatDate, formatHours, itemHref, usePlan, type PlanState } from './usePlan';

const PACE_COPY = {
  'on-track': 'On track',
  ahead: 'Ahead of plan',
  behind: 'Behind plan',
  past: 'The date has passed',
  'no-deadline': 'Your own pace',
} as const;

function ItemIcon({ item }: { item: PlanItem }) {
  if (item.kind === 'test') return <SquareTerminal aria-hidden size={16} strokeWidth={2} />;
  if (item.kind === 'habit') return <Repeat2 aria-hidden size={16} strokeWidth={2} />;
  return null;
}

/** The one thing to do now, why, and whether the plan is on time. Home shows it too. */
export function TodayCard({ state, headingLevel = 2 }: { state: PlanState; headingLevel?: 1 | 2 }) {
  const { plan, progress, pace, answers } = state;
  if (!plan || !progress || !answers) return null;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const next = progress.next;
  const phase = next ? plan.phases.find((p) => p.id === next.phaseId) : undefined;
  return (
    <section
      aria-labelledby="today-title"
      className="bg-surface border-border rounded-panel flex flex-col gap-3 border p-3 md:p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="t-label">Today · {plan.title}</p>
        {pace ? (
          <p
            className={cn(
              't-figure text-sm font-medium',
              pace.status === 'behind' || pace.status === 'past'
                ? 'text-warning'
                : pace.status === 'ahead'
                  ? 'text-success'
                  : 'text-muted',
            )}
          >
            {PACE_COPY[pace.status]}
            {pace.daysLeft !== undefined && pace.daysLeft >= 0
              ? ` · ${pace.daysLeft} ${pace.daysLeft === 1 ? 'day' : 'days'} left`
              : ''}
          </p>
        ) : null}
      </div>
      {next && phase ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Heading id="today-title" className="text-lg font-semibold">
              <InlineCode text={next.item.title} />
            </Heading>
            <p className="text-muted text-sm">
              {phase.title}: {phase.why}
            </p>
            {pace && pace.status !== 'no-deadline' && pace.status !== 'past' ? (
              <p className="text-muted text-sm">
                About {formatHours(pace.minutesPerDay)} a day finishes by{' '}
                {formatDate(answers.deadline ?? '')}.
              </p>
            ) : null}
          </div>
          <Link href={itemHref(next.item)} className={buttonClass('primary', 'lg', 'shrink-0')}>
            {next.item.kind === 'test'
              ? 'Sit the test'
              : next.item.kind === 'habit'
                ? 'Go'
                : 'Start'}{' '}
            · {formatHours(next.item.minutes)}
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        </div>
      ) : (
        <Heading id="today-title" className="text-lg font-semibold">
          Every step of your plan is done. Set a new goal, or keep it fresh in Review.
        </Heading>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ProgressLine
          value={progress.share}
          label="Plan done"
          className="max-w-50 min-w-20 flex-1"
        />
        <span className="t-figure text-muted shrink-0 text-sm">
          {Math.round(progress.share * 100)}% of {formatHours(plan.minutes)}
        </span>
        <Link
          href="/plan"
          className="text-muted hover:text-fg ml-auto shrink-0 text-sm underline-offset-4 hover:underline"
        >
          The whole plan
        </Link>
      </div>
    </section>
  );
}

export function PlanView({ catalog, onChange }: { catalog: PlanCatalog; onChange: () => void }) {
  const state = usePlan(catalog);
  const store = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const { plan, progress, answers, facts } = state;
  if (!plan || !progress || !answers) return null;
  const counted = plan.phases.filter((p) => !p.optional);
  const optional = plan.phases.filter((p) => p.optional);

  const phaseBlock = (phase: (typeof plan.phases)[number], number: number) => {
    const p = progress.phases.find((x) => x.id === phase.id);
    return (
      <li key={phase.id} className="rule-t flex flex-col gap-2 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="t-figure text-muted text-sm">{String(number).padStart(2, '0')}</span>
          <h3 className="text-lg font-semibold">{phase.title}</h3>
          {p && p.total > 0 ? (
            <span className="t-figure text-muted text-sm">
              {p.done}/{p.total} · {formatHours(phase.items.reduce((s, i) => s + i.minutes, 0))}
            </span>
          ) : null}
        </div>
        <p className="text-muted">{phase.why}</p>
        <ol className="flex flex-col">
          {phase.items.map((item) => {
            const done = itemDone(item, facts);
            const isNext = progress.next?.item === item;
            return (
              <li
                key={item.kind === 'lesson' ? item.id : item.kind === 'test' ? item.key : item.href}
              >
                <Link
                  href={itemHref(item)}
                  className={cn(
                    'hover:bg-raised rounded-control flex min-h-5 items-center gap-1 px-1 py-0.5 text-sm transition-colors duration-150 ease-out',
                    isNext && 'bg-accent-tint',
                  )}
                >
                  {done ? (
                    <Check
                      aria-label="done"
                      size={16}
                      strokeWidth={2.5}
                      className="text-success shrink-0"
                    />
                  ) : (
                    <Circle
                      aria-hidden
                      size={16}
                      strokeWidth={2}
                      className={cn('shrink-0', isNext ? 'text-accent' : 'text-border-strong')}
                    />
                  )}
                  <span
                    className={cn(
                      'min-w-0 flex-1',
                      done ? 'text-muted' : 'text-fg',
                      isNext && 'font-medium',
                    )}
                  >
                    <InlineCode text={item.title} />
                    {item.kind === 'test' ? ` · aim for ${item.target}%` : ''}
                    {item.kind === 'habit' ? ` · every ${item.every}` : ''}
                  </span>
                  <span className="text-muted shrink-0">
                    <ItemIcon item={item} />
                  </span>
                  <span className="t-figure text-muted shrink-0">{formatHours(item.minutes)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        {phase.milestone ? (
          <p
            className={cn(
              'rounded-control flex items-center gap-1 border px-1 py-1 text-sm',
              milestoneDone(phase.milestone, facts)
                ? 'border-success text-success'
                : 'border-border text-muted',
            )}
          >
            <Flag aria-hidden size={16} strokeWidth={2} />
            Milestone: {phase.milestone.title}
            {milestoneDone(phase.milestone, facts) ? ' · done' : ''}
          </p>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="t-label">Your plan</p>
        <h1 className="t-title" data-arrive="title">
          {plan.title}
        </h1>
        <p className="text-muted text-lg">
          {formatHours(plan.minutes)} of work at about {formatHours(answers.minutesPerWeek)} a week
          {answers.deadline ? `, until ${formatDate(answers.deadline)}` : ''}.
          {plan.trimmed ? ' What does not fit before then waits under "if time allows".' : ''}
        </p>
      </header>

      <TodayCard state={state} />

      <section aria-labelledby="phases-title" className="flex flex-col">
        <h2 id="phases-title" className="t-section pb-1">
          The phases
        </h2>
        <ol>{counted.map((phase, i) => phaseBlock(phase, i + 1))}</ol>
        {optional.length > 0 ? (
          <details className="rule-t group pt-2">
            <summary className="text-muted hover:text-fg cursor-pointer text-sm font-medium">
              If time allows · {optional.length} {optional.length === 1 ? 'phase' : 'phases'}
            </summary>
            <ol>{optional.map((phase, i) => phaseBlock(phase, counted.length + i + 1))}</ol>
          </details>
        ) : null}
      </section>

      <div className="rule-t flex flex-wrap items-center gap-1 pt-3">
        <Button variant="secondary" onClick={onChange}>
          Change my plan
        </Button>
        {confirmClear ? (
          <>
            <span className="text-muted text-sm">Clear the plan? Your progress stays.</span>
            <Button
              variant="quiet"
              onClick={() => {
                void store.record('plan_cleared', {});
                setConfirmClear(false);
              }}
            >
              Clear it
            </Button>
            <Button variant="quiet" onClick={() => setConfirmClear(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={() => setConfirmClear(true)}>
            Clear the plan
          </Button>
        )}
      </div>
    </div>
  );
}
