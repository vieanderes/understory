'use client';

import { ArrowLeft, ArrowRight, Flag } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import {
  buildPlan,
  GOAL_COPY,
  PLAN_GOALS,
  type PlanAnswers,
  type PlanCatalog,
  type PlanGoal,
  type PlanLanguage,
  type PlanLevel,
} from '@/core/plan';
import { useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { formatDate, formatHours, useToday } from './usePlan';

const WEEKLY = [
  { value: '60', label: '1 h' },
  { value: '120', label: '2 h' },
  { value: '210', label: '3½ h' },
  { value: '420', label: '7 h' },
  { value: '840', label: '14 h' },
] as const;

const LEVELS: { value: PlanLevel; label: string }[] = [
  { value: 'new', label: 'Never coded' },
  { value: 'some', label: 'Some code' },
  { value: 'pro', label: 'I code for work' },
];

const LANGUAGES: { value: PlanLanguage; label: string }[] = [
  { value: 'js', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
];

/** Goals where a date is the point, so the date question comes first and open. */
const DATED: readonly PlanGoal[] = ['interviews', 'senior'];

type Step = 'goal' | 'time' | 'start' | 'preview';
const STEPS: Step[] = ['goal', 'time', 'start', 'preview'];

interface PlanSetupProps {
  catalog: PlanCatalog;
  /** The current answers when changing a plan. */
  initial?: PlanAnswers | undefined;
  initialGoal?: PlanGoal | undefined;
  onDone: () => void;
  onCancel?: () => void;
}

/**
 * Setting up a plan: what you want, how much time, where you start. Three short questions,
 * then the plan itself to look at before it is saved. The answers go to the event log as
 * one plan_set; the phases are always rebuilt from them.
 */
export function PlanSetup({ catalog, initial, initialGoal, onDone, onCancel }: PlanSetupProps) {
  const store = useStore();
  const today = useToday();
  const [step, setStep] = useState<Step>(initial || initialGoal ? 'time' : 'goal');
  const [goal, setGoal] = useState<PlanGoal>(initial?.goal ?? initialGoal ?? 'from-zero');
  const [hasDate, setHasDate] = useState(initial ? Boolean(initial.deadline) : false);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [weekly, setWeekly] = useState(String(initial?.minutesPerWeek ?? 210));
  const [level, setLevel] = useState<PlanLevel>(initial?.level ?? 'new');
  const [language, setLanguage] = useState<PlanLanguage>(initial?.language ?? 'js');
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const dateId = useId();
  const dated = hasDate || DATED.includes(goal);
  const validDate = !dated || (deadline !== '' && deadline >= today);

  const answers: PlanAnswers = {
    goal,
    level,
    language,
    minutesPerWeek: Number(weekly),
    ...(dated && deadline ? { deadline } : {}),
    since: today || '2026-01-01',
  };
  // Cheap to build: the preview follows every answer as it changes.
  const preview = buildPlan(answers, catalog);

  const index = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]!);
  const back = () => (index === 0 ? onCancel?.() : setStep(STEPS[index - 1]!));

  async function save() {
    setSaving(true);
    await store.record('plan_set', answers);
    setSaving(false);
    onDone();
  }

  return (
    <section aria-labelledby={titleId} className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="t-label t-figure">
          {initial ? 'Change your plan' : 'Make your plan'} · step {index + 1} of {STEPS.length}
        </p>
        <h1 id={titleId} className="t-section">
          {step === 'goal'
            ? 'What do you want to be able to do?'
            : step === 'time'
              ? 'How much time do you have?'
              : step === 'start'
                ? 'Where are you starting from?'
                : 'Your plan'}
        </h1>
      </div>

      {step === 'goal' ? (
        <div
          role="radiogroup"
          aria-labelledby={titleId}
          className="grid grid-cols-1 gap-1 sm:grid-cols-2"
        >
          {PLAN_GOALS.map((id) => {
            const selected = id === goal;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setGoal(id);
                  if (DATED.includes(id)) setHasDate(true);
                  next();
                }}
                className={cn(
                  'rounded-panel flex flex-col items-start gap-0.5 border p-2 text-left transition-colors duration-150 ease-out',
                  selected
                    ? 'border-accent bg-accent-tint'
                    : 'border-border hover:border-border-strong hover:bg-raised',
                )}
              >
                <span className="font-medium">{GOAL_COPY[id].title}</span>
                <span className="text-muted text-sm">{GOAL_COPY[id].who}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 'time' ? (
        <div className="flex flex-col gap-3">
          {DATED.includes(goal) ? null : (
            <label className="flex min-h-5 cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={hasDate}
                onChange={(event) => setHasDate(event.target.checked)}
                className="accent-accent size-2"
              />
              There is a date I am working towards
            </label>
          )}
          {dated ? (
            <div className="flex flex-col gap-0.5">
              <label htmlFor={dateId} className="t-label">
                {goal === 'interviews' || goal === 'senior'
                  ? 'The interview or test is on'
                  : 'I want to be ready by'}
              </label>
              <input
                id={dateId}
                type="date"
                min={today}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="bg-surface border-border rounded-control h-5 w-fit border px-1"
              />
            </div>
          ) : null}
          <Segmented label="Time a week" value={weekly} onChange={setWeekly} options={WEEKLY} />
          <p className="text-muted text-sm">
            About {formatHours(Math.round(Number(weekly) / 7))} a day. Short and often beats long
            and rare.
          </p>
        </div>
      ) : null}

      {step === 'start' ? (
        <div className="flex flex-col gap-3">
          <Segmented label="Coding so far" value={level} onChange={setLevel} options={LEVELS} />
          <Segmented
            label="Main language"
            value={language}
            onChange={setLanguage}
            options={LANGUAGES}
          />
        </div>
      ) : null}

      {step === 'preview' ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted">
            {preview.title}. {formatHours(preview.minutes)} of work
            {answers.deadline ? `, by ${formatDate(answers.deadline)}` : ''}, in{' '}
            {preview.phases.filter((p) => !p.optional).length} phases.
            {preview.trimmed
              ? ' It does not all fit before your date, so the rest waits under "if time allows".'
              : ''}
          </p>
          <ol className="border-border rounded-panel divide-border divide-y overflow-hidden border">
            {[
              ...preview.phases.filter((p) => !p.optional),
              ...preview.phases.filter((p) => p.optional),
            ].map((phase, i) => (
              <li
                key={phase.id}
                className={cn('flex flex-col gap-0.5 p-2', phase.optional && 'bg-sunken')}
              >
                <p className="flex flex-wrap items-baseline gap-x-1">
                  <span className="t-figure text-muted text-sm">{i + 1}</span>
                  <span className="font-medium">{phase.title}</span>
                  <span className="text-muted t-figure text-sm">
                    {phase.optional
                      ? 'if time allows'
                      : formatHours(phase.items.reduce((s, it) => s + it.minutes, 0))}
                  </span>
                </p>
                <p className="text-muted text-sm">{phase.why}</p>
                {phase.milestone ? (
                  <p className="flex items-center gap-0.5 text-sm">
                    <Flag aria-hidden size={16} strokeWidth={2} className="text-muted" />
                    {phase.milestone.title}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        {index > 0 || onCancel ? (
          <Button variant="quiet" onClick={back}>
            <ArrowLeft aria-hidden size={16} strokeWidth={2} />
            {index === 0 ? 'Cancel' : 'Back'}
          </Button>
        ) : null}
        {step === 'preview' ? (
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            {initial ? 'Save the new plan' : 'Start this plan'}
          </Button>
        ) : step !== 'goal' ? (
          <Button variant="primary" onClick={next} disabled={step === 'time' && !validDate}>
            Next
            <ArrowRight aria-hidden size={16} strokeWidth={2} />
          </Button>
        ) : null}
      </div>
    </section>
  );
}
