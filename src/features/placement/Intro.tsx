'use client';

import { Button } from '@/components/ui/Button';
import type { CompiledPlacementArea } from '@/core/content/placement-schema';
import { AREA_LEVELS, type AreaRating, type StartedAs } from '@/core/placement';
import { Title } from '@/features/motion/Title';
import { cn } from '@/lib/cn';

const STARTS: readonly { value: StartedAs; label: string; note: string }[] = [
  { value: 'new', label: 'New to code', note: 'Checks the very first steps.' },
  { value: 'ai-builder', label: 'I build with AI', note: 'Checks where gaps often hide.' },
  { value: 'experienced', label: 'Experienced', note: 'Checks every area.' },
];

const RATINGS: readonly { value: AreaRating; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'some', label: 'Some' },
  { value: 'confident', label: 'Confident' },
];

/** About 40 seconds a question, rounded up to whole minutes. */
const minutesFor = (questions: number) => Math.max(1, Math.ceil((questions * 40) / 60));

const choice = (selected: boolean) =>
  cn(
    'rounded-control flex cursor-pointer border transition-colors duration-150 ease-out',
    'has-focus-visible:outline-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
    selected ? 'border-accent bg-accent-tint' : 'border-border hover:bg-raised',
  );

/**
 * The start of the full check: where the learner comes from, then how they rate each
 * area. An area rated New asks nothing; the opening answer only fills in the ratings.
 */
export function Intro({
  areas,
  startedAs,
  ratings,
  onStartedAs,
  onRate,
  onBegin,
  ready,
}: {
  areas: readonly CompiledPlacementArea[];
  startedAs: StartedAs | null;
  ratings: Readonly<Record<string, AreaRating>>;
  onStartedAs: (value: StartedAs) => void;
  onRate: (areaId: string, rating: AreaRating) => void;
  onBegin: () => void;
  ready: boolean;
}) {
  const checked = areas.filter((a) => (ratings[a.id] ?? 'new') !== 'new').length;
  const questions = checked * AREA_LEVELS;

  return (
    <section aria-labelledby="start-title" className="step-in flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-2">
        <Title id="start-title">Find your level.</Title>
        <p className="text-muted prose-measure">
          Each area of the course gets its own short check, up to three questions that get harder
          when you answer well. You get a level per area, an overall level and a path to start on.
          Nothing is locked, whatever the result.
        </p>
      </div>

      <fieldset className="prose-measure flex min-w-0 flex-col gap-1">
        <legend className="mb-1 font-medium">Where are you starting from?</legend>
        {STARTS.map((option) => (
          <label
            key={option.value}
            className={cn(
              choice(startedAs === option.value),
              'min-h-6 flex-col justify-center px-2 py-1',
            )}
          >
            <input
              type="radio"
              name="started-as"
              value={option.value}
              checked={startedAs === option.value}
              onChange={() => onStartedAs(option.value)}
              className="sr-only"
            />
            <span className="font-medium">{option.label}</span>
            <span className="text-muted text-sm">{option.note}</span>
          </label>
        ))}
      </fieldset>

      {startedAs ? (
        <div className="prose-measure flex flex-col gap-1">
          <h2 className="font-medium">How much have you done in each area?</h2>
          <p className="text-muted text-sm">New skips the area. Confident starts a level higher.</p>
          <ul className="flex flex-col pt-1">
            {areas.map((area) => (
              <li key={area.id} className="rule-t py-1">
                <fieldset className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <legend className="float-left min-w-0 flex-1 sm:py-1">{area.title}</legend>
                  <div className="flex gap-0.5">
                    {RATINGS.map((rating) => {
                      const selected = (ratings[area.id] ?? 'new') === rating.value;
                      return (
                        <label
                          key={rating.value}
                          className={cn(
                            choice(selected),
                            'h-5 flex-1 items-center justify-center px-1.5 text-sm sm:flex-none',
                          )}
                        >
                          <input
                            type="radio"
                            name={`rating-${area.id}`}
                            value={rating.value}
                            checked={selected}
                            onChange={() => onRate(area.id, rating.value)}
                            className="sr-only"
                          />
                          {rating.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={onBegin}
          disabled={startedAs === null || checked === 0 || !ready}
        >
          Start
        </Button>
        {startedAs ? (
          <p className="t-label text-muted" aria-live="polite">
            {checked === 0
              ? 'Rate one area Some or Confident to start'
              : `${checked} ${checked === 1 ? 'area' : 'areas'} · up to ${questions} questions · about ${minutesFor(questions)} min`}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** The start of the deeper check of one area. */
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
          {title}. <span className="text-muted">Up to {questions} questions.</span>
        </Title>
        <p className="text-muted prose-measure">
          A level counts once you get two of its questions right, so this check is steadier than the
          quick one. It updates this area only. Nothing is locked, whatever the result.
        </p>
      </div>
      <Button variant="primary" className="self-start" onClick={onBegin} disabled={!ready}>
        Start
      </Button>
    </section>
  );
}
