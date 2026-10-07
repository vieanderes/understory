'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { CompiledPlacementArea } from '@/core/content/placement-schema';
import type { PlacementMode } from '@/core/placement';
import { Title } from '@/features/motion/Title';
import { cn } from '@/lib/cn';

const MODES: readonly { value: PlacementMode; label: string; note: string }[] = [
  { value: 'quick', label: 'Quick', note: 'A rough picture: two modules of each part.' },
  {
    value: 'balanced',
    label: 'Balanced',
    note: 'Every module once, a harder one when you know it.',
  },
  {
    value: 'thorough',
    label: 'Thorough',
    note: 'Every module, each answer confirmed. The surest result.',
  },
];

/** Questions a module asks on average: the core, and a follow-up about half the time. */
const TYPICAL_PER_MODULE: Readonly<Record<PlacementMode, number>> = {
  quick: 1.7,
  balanced: 1.7,
  thorough: 2.6,
};

/** About 30 seconds a question, the answer included. */
const minutesFor = (questions: number) => Math.max(1, Math.round(questions / 2));

export const typicalQuestions = (modules: number, mode: PlacementMode) =>
  Math.max(modules, Math.round(modules * TYPICAL_PER_MODULE[mode]));

const toggle = (selected: boolean) =>
  cn(
    'rounded-control flex cursor-pointer border text-left transition-colors duration-150 ease-out active:scale-98',
    'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
    'has-focus-visible:outline-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
    selected ? 'border-fg bg-raised' : 'border-border hover:bg-raised',
  );

/**
 * The start of the check: which parts of the course to measure, and how long to spend.
 * Parts someone has never touched, or does not care about, are left out rather than
 * asked about, and the time each choice takes is said up front.
 */
export function Intro({
  areas,
  picked,
  mode,
  onToggle,
  onAll,
  onMode,
  onStart,
  modulesFor,
  ready,
}: {
  areas: readonly CompiledPlacementArea[];
  picked: readonly string[];
  mode: PlacementMode;
  onToggle: (areaId: string) => void;
  onAll: (all: boolean) => void;
  onMode: (mode: PlacementMode) => void;
  onStart: () => void;
  /** How many modules a mode asks over the picked parts. */
  modulesFor: (mode: PlacementMode) => number;
  ready: boolean;
}) {
  const allPicked = picked.length === areas.length;
  const questions = typicalQuestions(modulesFor(mode), mode);

  return (
    <section aria-labelledby="start-title" className="step-in flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-2">
        <Title id="start-title">Find your level.</Title>
        <p className="text-muted prose-measure">
          Pick what to check and how long you have. Quick questions, the answer after each one, and
          at the end a clear picture: where you are solid, where to go deeper, where to start.
        </p>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <legend className="font-medium">What should we check?</legend>
          <button
            type="button"
            onClick={() => onAll(!allPicked)}
            className="hover:text-accent text-muted inline-flex min-h-5 items-center text-sm underline underline-offset-4"
          >
            {allPicked ? 'Clear all' : 'Pick all'}
          </button>
        </div>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((area) => {
            const selected = picked.includes(area.id);
            return (
              <li key={area.id} className="flex">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggle(area.id)}
                  className={cn(toggle(selected), 'min-h-8 w-full items-center gap-1 px-2 py-1')}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{area.title}</span>
                    <span className="t-label text-muted">{area.modules.length} modules</span>
                  </span>
                  <Check
                    aria-hidden
                    size={16}
                    strokeWidth={2}
                    className={cn(
                      'shrink-0 transition-opacity duration-150 ease-out',
                      selected ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="prose-measure flex min-w-0 flex-col gap-1">
        <legend className="mb-1 font-medium">How thorough?</legend>
        {MODES.map((option) => {
          const selected = option.value === mode;
          const count = typicalQuestions(modulesFor(option.value), option.value);
          return (
            <label
              key={option.value}
              className={cn(toggle(selected), 'min-h-6 items-center gap-2 px-2 py-1')}
            >
              <input
                type="radio"
                name="placement-mode"
                value={option.value}
                checked={selected}
                onChange={() => onMode(option.value)}
                className="sr-only"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-muted text-sm">{option.note}</span>
              </span>
              {picked.length > 0 ? (
                <span className="t-label t-figure text-muted shrink-0 text-right">
                  ~{count} questions
                  <span className="max-sm:hidden"> · {minutesFor(count)} min</span>
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onStart} disabled={picked.length === 0 || !ready}>
          Start
        </Button>
        <p className="t-label text-muted" aria-live="polite">
          {picked.length === 0
            ? 'Pick at least one part'
            : `${picked.length} ${picked.length === 1 ? 'part' : 'parts'} · about ${questions} questions · ${minutesFor(questions)} min`}
        </p>
      </div>
    </section>
  );
}

/** The start of the thorough check of one area, linked from a result. */
export function AreaIntro({
  title,
  questions,
  onBegin,
  ready,
}: {
  title: string;
  questions: number;
  onBegin: () => void;
  ready: boolean;
}) {
  return (
    <section aria-labelledby="start-title" className="step-in flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-2">
        <Title id="start-title">
          {title}. <span className="text-muted">About {questions} questions.</span>
        </Title>
        <p className="text-muted prose-measure">
          Every module of this part, each answer confirmed, so this is the surest check there is. It
          updates this part only.
        </p>
      </div>
      <Button variant="primary" className="self-start" onClick={onBegin} disabled={!ready}>
        Start
      </Button>
    </section>
  );
}
