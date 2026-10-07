'use client';

import { ArrowLeft, ArrowRight, Check, Flag } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import {
  buildPlan,
  GOAL_COPY,
  type PlanAnswers,
  type PlanCatalog,
  type PlanGoal,
  type PlanLanguage,
  type PlanLevel,
} from '@/core/plan';
import { INTEREST_COPY, INTERESTS, interestsForGoal, type Interest } from '@/core/profile';
import type { PayloadOf } from '@/core/progress';
import { useStore } from '@/features/store/StoreProvider';
import { cn } from '@/lib/cn';
import { formatDate, formatHours, useToday } from './usePlan';

/** Minutes a day; the plan keeps minutes a week, so these are multiplied by seven. */
const DAILY = [
  { value: '10', label: '10 min' },
  { value: '20', label: '20 min' },
  { value: '45', label: '45 min' },
  { value: '90', label: '1½ h' },
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

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

/** Goals where a date is the point, so the date question comes first and open. */
const DATED: readonly PlanGoal[] = ['interviews', 'senior'];

/** "Just the news" is a goal too: no plan, a Home that leads with the edition. */
type Goal = PlanGoal | 'news';
const NEWS_ONLY = {
  title: 'Just follow the news',
  who: 'A short daily read on what changed in software, and why it matters.',
};

type Step = 'goal' | 'interests' | 'start' | 'time' | 'news' | 'preview';
const PLAN_STEPS: Step[] = ['goal', 'interests', 'start', 'time', 'news', 'preview'];
const NEWS_STEPS: Step[] = ['goal', 'interests'];

const TITLES: Record<Step, string> = {
  goal: 'What would you like to do?',
  interests: 'What are you interested in?',
  start: 'Where are you starting from?',
  time: 'How much time do you have a day?',
  news: "Would you like today's news on Home?",
  preview: 'Your plan',
};

/** The goals in groups, so twelve choices read as four short lists. */
const GROUPS: { title: string; goals: readonly Goal[] }[] = [
  { title: 'Start', goals: ['from-zero', 'first-job', 'second-language', 'everything'] },
  { title: 'Grow', goals: ['refresh', 'refresh-specialise', 'builder', 'ai-engineer'] },
  { title: 'Get ready', goals: ['interviews', 'senior'] },
  { title: 'Keep up', goals: ['stay-sharp', 'news'] },
];

const daily = (minutesPerWeek: number) =>
  String(
    DAILY.reduce((best, d) =>
      Math.abs(Number(d.value) * 7 - minutesPerWeek) <
      Math.abs(Number(best.value) * 7 - minutesPerWeek)
        ? d
        : best,
    ).value,
  );

interface PlanSetupProps {
  catalog: PlanCatalog;
  /** The current answers when changing a plan. */
  initial?: PlanAnswers | undefined;
  initialProfile?: PayloadOf<'profile_set'> | undefined;
  initialGoal?: PlanGoal | undefined;
  onDone: () => void;
  onCancel?: () => void;
}

/**
 * Setting up: what you want, what interests you, where you start, how much time, and whether
 * Home shows the news. One short question a screen, most answered with one tap, then the plan
 * to look at before it is saved. The answers go to the event log as plan_set and profile_set;
 * the phases, the practice topics and the order of the news are always derived from them.
 */
export function PlanSetup({
  catalog,
  initial,
  initialProfile,
  initialGoal,
  onDone,
  onCancel,
}: PlanSetupProps) {
  const store = useStore();
  const today = useToday();
  const editing = initial !== undefined || initialProfile !== undefined;
  const firstGoal: Goal =
    initial?.goal ?? initialGoal ?? (initialProfile && !initial ? 'news' : 'from-zero');
  const [step, setStep] = useState<Step>(initialGoal && !editing ? 'interests' : 'goal');
  const [goal, setGoal] = useState<Goal>(firstGoal);
  const [interests, setInterests] = useState<readonly Interest[]>(
    initialProfile?.interests ?? (firstGoal === 'news' ? [] : interestsForGoal(firstGoal)),
  );
  const [hasDate, setHasDate] = useState(initial ? Boolean(initial.deadline) : false);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [perDay, setPerDay] = useState(daily(initial?.minutesPerWeek ?? 140));
  const [level, setLevel] = useState<PlanLevel>(initial?.level ?? 'new');
  const [language, setLanguage] = useState<PlanLanguage>(initial?.language ?? 'js');
  const [news, setNews] = useState<'yes' | 'no'>(initialProfile?.news === false ? 'no' : 'yes');
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const dateId = useId();

  const newsOnly = goal === 'news';
  const steps = newsOnly ? NEWS_STEPS : PLAN_STEPS;
  const index = steps.indexOf(step);
  const last = index === steps.length - 1;
  const dated = !newsOnly && (hasDate || DATED.includes(goal));
  const validDate = !dated || (deadline !== '' && deadline >= today);

  const answers: PlanAnswers | undefined = newsOnly
    ? undefined
    : {
        goal,
        level,
        language,
        minutesPerWeek: Number(perDay) * 7,
        ...(dated && deadline ? { deadline } : {}),
        since: today || '2026-01-01',
        // The focus keeps the order the learner tapped, which is the order of the phases.
        ...(goal === 'refresh-specialise' && interests.length > 0 ? { focus: [...interests] } : {}),
      };
  // Cheap to build: the preview follows every answer as it changes.
  const preview = answers ? buildPlan(answers, catalog) : undefined;

  const next = () => setStep(steps[Math.min(steps.length - 1, index + 1)]!);
  const back = () => (index === 0 ? onCancel?.() : setStep(steps[index - 1]!));

  function pickGoal(id: Goal) {
    setGoal(id);
    if (id !== 'news' && DATED.includes(id)) setHasDate(true);
    // A new goal suggests its interests, unless the learner already chose their own.
    if (!initialProfile) setInterests(id === 'news' ? [] : interestsForGoal(id));
    setStep('interests');
  }

  function toggle(id: Interest) {
    setInterests((current) =>
      current.includes(id) ? current.filter((i) => i !== id) : [...current, id],
    );
  }

  async function save() {
    setSaving(true);
    await store.record('profile_set', {
      interests: INTERESTS.filter((id) => interests.includes(id)),
      news: newsOnly || news === 'yes',
    });
    if (answers) await store.record('plan_set', answers);
    else if (initial) await store.record('plan_cleared', {});
    setSaving(false);
    onDone();
  }

  const copyOf = (id: Goal) => (id === 'news' ? NEWS_ONLY : GOAL_COPY[id]);
  const specialise = goal === 'refresh-specialise';

  return (
    <section aria-labelledby={titleId} className="flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="t-label t-figure">
          {editing ? 'Your goals' : 'Set up'}
          {step === 'preview'
            ? ''
            : ` · ${index + 1} of ${steps.filter((s) => s !== 'preview').length}`}
        </p>
        <h1 id={titleId} className="t-section">
          {step === 'interests' && specialise
            ? 'What would you like to specialise in?'
            : TITLES[step]}
        </h1>
      </div>

      {step === 'goal' ? (
        <div className="flex flex-col gap-4">
          <p className="text-muted">Pick the closest. You can change it any time.</p>
          {GROUPS.map((group) => (
            <section key={group.title} className="flex flex-col gap-0.5">
              <h2 className="t-label pb-0.5">{group.title}</h2>
              <div
                role="radiogroup"
                aria-label={group.title}
                className="grid grid-cols-1 gap-x-4 sm:grid-cols-2"
              >
                {group.goals.map((id) => {
                  const { title, who } = copyOf(id);
                  // Only an answer already given is shown as chosen; a first visit starts with none.
                  const selected = editing && id === goal;
                  return (
                    <div key={id} className="rule-t">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => pickGoal(id)}
                        className={cn(
                          'hairline-row group flex min-h-6 w-full items-center gap-2 py-2 text-left transition-colors duration-150 ease-out',
                          selected && 'bg-raised',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={cn('block font-medium', selected && 'font-semibold')}>
                            {title}
                          </span>
                          <span className="text-muted block text-sm">{who}</span>
                        </span>
                        <ArrowRight
                          aria-hidden
                          size={16}
                          strokeWidth={2}
                          className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                        />
                      </button>
                    </div>
                  );
                })}
                {group.title === 'Keep up' ? (
                  <div className="rule-t">
                    <Link
                      href="/learn/build"
                      className="hairline-row group flex min-h-6 w-full items-center gap-2 py-2 text-left transition-colors duration-150 ease-out"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">Choose my own lessons</span>
                        <span className="text-muted block text-sm">
                          Pick parts, chapters or single lessons from the whole course.
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden
                        size={16}
                        strokeWidth={2}
                        className="text-faint group-hover:text-fg shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {step === 'interests' ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted">
            {specialise
              ? 'Pick one or more, in the order you want to go deep. Practice and the news start with these too.'
              : 'Pick any. Practice and the news start with these. Nothing else is hidden.'}
          </p>
          <ul aria-labelledby={titleId} className="flex flex-wrap gap-1">
            {INTERESTS.map((id) => {
              const on = interests.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(id)}
                    className={cn(
                      'rounded-control transition-press inline-flex h-5 items-center gap-0.5 border px-1.5 text-sm font-medium active:scale-98',
                      on
                        ? 'border-fg bg-fg text-bg'
                        : 'border-border text-muted hover:border-border-strong hover:text-fg',
                    )}
                  >
                    {on ? <Check aria-hidden size={16} strokeWidth={2} /> : null}
                    {INTEREST_COPY[id].label}
                  </button>
                </li>
              );
            })}
          </ul>
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
          <p className="text-muted text-sm">
            Not sure?{' '}
            <Link href="/start" className="text-fg underline underline-offset-4">
              Find your level, area by area
            </Link>
            .
          </p>
        </div>
      ) : null}

      {step === 'time' ? (
        <div className="flex flex-col gap-3">
          <Segmented label="Time a day" value={perDay} onChange={setPerDay} options={DAILY} />
          {DATED.includes(goal as PlanGoal) ? null : (
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
                {DATED.includes(goal as PlanGoal)
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
        </div>
      ) : null}

      {step === 'news' ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted">
            A short daily edition: what changed in software and why it matters. Always there under
            News either way.
          </p>
          <Segmented
            label="Show today's news on Home"
            hideLabel
            value={news}
            onChange={setNews}
            options={YES_NO}
          />
        </div>
      ) : null}

      {step === 'preview' && preview && answers ? (
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
                {phase.milestone ? (
                  <p className="text-muted flex items-center gap-0.5 text-sm">
                    <Flag aria-hidden size={16} strokeWidth={2} />
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
        {last ? (
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            {newsOnly ? 'Show me the news' : editing ? 'Save' : 'Start'}
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
