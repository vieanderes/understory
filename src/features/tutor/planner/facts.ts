import { formatMinutes } from '@/core/insight';
import { pathPace, type Draft, type DraftFacts } from '@/core/planner';

/*
 * A draft in words, for the card and the draft view: its size, and how long it takes at the
 * pace it was planned for. Counted from the course, never from what Scout wrote.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function sizeLine(draft: Draft, facts: DraftFacts): string {
  return [
    plural(draft.stages.length, 'stage', 'stages'),
    plural(facts.lessons, 'lesson', 'lessons'),
    `about ${formatMinutes(facts.minutes)}`,
  ].join(' · ');
}

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/** How long it takes, or what it would take to finish by the deadline. Undefined without a pace. */
export function paceLine(draft: Draft, facts: DraftFacts, today: string): string | undefined {
  if (facts.minutesLeft === 0) return facts.lessons > 0 ? 'Every lesson in it is done.' : undefined;
  if (!draft.minutesPerWeek && !draft.deadline) return undefined;
  const pace = pathPace(
    facts.minutesLeft,
    {
      minutesPerWeek: draft.minutesPerWeek ?? 60,
      ...(draft.deadline ? { deadline: draft.deadline } : {}),
    },
    today,
  );
  const perWeek = draft.minutesPerWeek ? formatMinutes(draft.minutesPerWeek) : undefined;
  const weeks = perWeek ? `About ${plural(pace.weeks, 'week', 'weeks')} at ${perWeek} a week` : '';
  if (!draft.deadline || pace.daysLeft === undefined) return `${weeks}.`;
  if (pace.daysLeft < 0)
    return `${weeks ? `${weeks}. ` : ''}The deadline, ${day(draft.deadline)}, has passed.`;
  if (pace.fits) return `${weeks}, done before ${day(draft.deadline)}.`;
  const needed = `${formatMinutes(pace.minutesPerWeekNeeded ?? 0)} a week`;
  return weeks
    ? `${weeks}. To finish by ${day(draft.deadline)} it needs ${needed}.`
    : `To finish by ${day(draft.deadline)} it needs ${needed}.`;
}
