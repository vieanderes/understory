import type { Draft } from './draft';

/*
 * What Scout knows about the learner while planning, as the `planner` text of its context:
 * the date, what setup asked, what is done, and the draft as the learner sees it now. Scout
 * asks only what this does not already answer.
 */

export interface PlannerSituationInput {
  /** YYYY-MM-DD, so a deadline can be counted. */
  today: string;
  setup?: {
    goal: string;
    level: 'new' | 'some' | 'pro';
    language: 'js' | 'python';
    minutesPerWeek: number;
    deadline?: string;
  };
  interests?: readonly string[];
  /** The latest placement level per area, 0 new to 3 advanced, in course order. */
  placement?: readonly { area: string; level: number }[];
  /** Per chapter, in course order. Chapters with nothing done are left out. */
  done: readonly { chapter: string; id: string; done: number; total: number }[];
  lessons: number;
  ownPaths?: readonly string[];
  draft?: Draft;
  edited?: boolean;
  saved?: boolean;
}

const LEVEL = {
  new: 'new to code',
  some: 'has written some code',
  pro: 'works as a developer',
} as const;

const LANGUAGE = { js: 'JavaScript', python: 'Python' } as const;

function setupLine(setup: NonNullable<PlannerSituationInput['setup']>): string {
  const parts = [
    `goal ${setup.goal}`,
    LEVEL[setup.level],
    `prefers ${LANGUAGE[setup.language]}`,
    `${setup.minutesPerWeek} minutes a week`,
    ...(setup.deadline ? [`deadline ${setup.deadline}`] : []),
  ];
  return `From setup: ${parts.join('; ')}.`;
}

function draftLines(input: PlannerSituationInput): string[] {
  const { draft } = input;
  if (!draft) return ['No draft yet.'];
  const pace = [
    ...(draft.minutesPerWeek ? [`Pace: ${draft.minutesPerWeek} minutes a week.`] : []),
    ...(draft.deadline ? [`Deadline: ${draft.deadline}.`] : []),
  ];
  return [
    input.edited ? 'Current draft, edited by the learner: start from this one.' : 'Current draft:',
    [`Name: ${draft.name}.`, ...pace].join(' '),
    ...draft.stages.map((s) => `- ${s.title}: ${s.lessonIds.join(', ')}`),
    ...(input.saved
      ? ['It is saved as one of their paths; changes are saved again when they press Save.']
      : []),
  ];
}

export function plannerSituation(input: PlannerSituationInput): string {
  const begun = input.done.filter((c) => c.done > 0);
  const doneTotal = begun.reduce((sum, c) => sum + c.done, 0);
  return [
    `Today is ${input.today}.`,
    ...(input.setup ? [setupLine(input.setup)] : []),
    ...(input.interests?.length ? [`Interests: ${input.interests.join(', ')}.`] : []),
    ...(input.placement?.length
      ? [
          `Placement by area (0 new, 1 foundations, 2 working, 3 advanced): ${input.placement
            .map((p) => `${p.area} ${p.level}`)
            .join(', ')}.`,
          'Leave out lessons an area at 2 or 3 already covers, unless they ask for them.',
        ]
      : []),
    doneTotal > 0 ? `Lessons done: ${doneTotal} of ${input.lessons}.` : 'Lessons done: none yet.',
    ...begun.map(
      (c) =>
        `- ${c.chapter} (${c.id}): ${c.done === c.total ? `all ${c.total}` : `${c.done} of ${c.total}`}`,
    ),
    ...(input.ownPaths?.length ? [`Paths they already made: ${input.ownPaths.join(', ')}.`] : []),
    '',
    ...draftLines(input),
  ].join('\n');
}
