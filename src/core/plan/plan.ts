import type { Interest } from '@/core/profile/interests';

/*
 * "Your plan" (docs/LEARNING-SCIENCE.md, "Plans"): the learner says what they want, how
 * much time they have and where they start; the plan orders the course for them into phases
 * with a reason and a milestone each, trims to fit a deadline, and says what to do today.
 *
 * The answers are a fact in the event log (plan_set). Everything else here is derived from
 * them and from the catalogue, so a plan follows the content as it changes and progress is
 * counted from completed lessons, tests and exams, never stored twice.
 */

export const PLAN_GOALS = [
  'from-zero',
  'first-job',
  'second-language',
  'everything',
  'refresh',
  'refresh-specialise',
  'builder',
  'ai-engineer',
  'interviews',
  'senior',
  'stay-sharp',
] as const;
export type PlanGoal = (typeof PLAN_GOALS)[number];

export type PlanLevel = 'new' | 'some' | 'pro';
export type PlanLanguage = 'js' | 'python';

export interface PlanAnswers {
  goal: PlanGoal;
  level: PlanLevel;
  language: PlanLanguage;
  minutesPerWeek: number;
  /** An interview or a start date, as YYYY-MM-DD. Without one the plan runs at its own pace. */
  deadline?: string;
  /** The day the plan was set, YYYY-MM-DD. Pace is counted from it. */
  since: string;
  /** What to go deep in after a refresh, in the learner's order. */
  focus?: Interest[];
}

// ---- The catalogue a plan is built from ---------------------------------------------------

export interface PlanLesson {
  id: string;
  title: string;
  minutes: number;
  /** Where the lesson opens. */
  href?: string;
}

export interface PlanCatalog {
  paths: { id: string; name: string; stages: { title: string; lessons: PlanLesson[] }[] }[];
  parts: { id: string; title: string; lessons: PlanLesson[] }[];
  tests: { key: string; title: string; minutes: number }[];
}

// ---- The plan ----------------------------------------------------------------------------

export type PlanItem =
  | { kind: 'lesson'; id: string; title: string; minutes: number; href?: string }
  | { kind: 'test'; key: string; title: string; minutes: number; target: number }
  | { kind: 'habit'; href: string; title: string; minutes: number; every: 'day' | 'week' };

export type Milestone =
  | { kind: 'path-exam'; pathId: string; title: string }
  | { kind: 'test'; key: string; title: string; target: number }
  | { kind: 'checkpoint'; partId: string; title: string };

export interface Phase {
  id: string;
  title: string;
  why: string;
  items: PlanItem[];
  milestone?: Milestone;
  /** Trimmed to fit the deadline: shown as "if time allows", not counted in the pace. */
  optional?: boolean;
}

export interface Plan {
  goal: PlanGoal;
  title: string;
  summary: string;
  phases: Phase[];
  /** Minutes of the phases that are not optional. */
  minutes: number;
  /** Set when phases had to be trimmed to fit the deadline. */
  trimmed: boolean;
}

export const GOAL_COPY: Record<PlanGoal, { title: string; who: string }> = {
  'from-zero': {
    title: 'Learn to code from scratch',
    who: 'Start with your first line of code. No experience needed.',
  },
  'first-job': {
    title: 'Get my first developer job',
    who: 'Go from the basics to a real app, then practise the tests and interviews that hire.',
  },
  'second-language': {
    title: 'Learn a second language',
    who: 'You know TypeScript or Python and want the other one too.',
  },
  everything: {
    title: 'Learn it all, in a good order',
    who: 'The whole course, one part after another, starting where you are.',
  },
  refresh: {
    title: 'Refresh my fundamentals',
    who: 'Feel confident writing code by hand again, without an assistant doing it for you.',
  },
  'refresh-specialise': {
    title: 'Refresh, then specialise',
    who: 'Get the basics back first, then go deep in the areas you choose.',
  },
  builder: {
    title: 'Build and ship full-stack apps',
    who: 'Make a real app that runs in production: web, server and data.',
  },
  'ai-engineer': {
    title: 'Become an AI engineer',
    who: 'Build products with language models, and understand why they fail.',
  },
  interviews: {
    title: 'Get ready for coding interviews',
    who: 'Prepare for an online coding test or a live coding round.',
  },
  senior: {
    title: 'Prepare for senior interviews',
    who: 'Practise system design and explaining your trade-offs out loud.',
  },
  'stay-sharp': {
    title: 'Stay sharp',
    who: 'Ten minutes a day to keep your skills fresh.',
  },
};

interface PhaseSpec {
  id: string;
  title: string;
  why: string;
  /** Lower goes first when time is short. */
  priority: number;
  lessons?: { path: string; stages?: number[] } | { part: string };
  tests?: { key: string; target: number }[];
  habits?: { href: string; title: string; minutes: number; every: 'day' | 'week' }[];
  milestone?: Milestone;
}

const lang = (language: PlanLanguage) =>
  language === 'python' ? 'python' : 'javascript-typescript';
const other = (language: PlanLanguage) =>
  language === 'python' ? 'javascript-typescript' : 'python';

function exam(pathId: string, title: string): Milestone {
  return { kind: 'path-exam', pathId, title };
}

/** The deep phase for one focus, after a refresh. Each is a path or a part of the course. */
function focusPhase(focus: Interest, priority: number): PhaseSpec {
  const phase = (
    title: string,
    why: string,
    lessons: PhaseSpec['lessons'],
    milestone?: Milestone,
  ): PhaseSpec => ({
    id: `focus-${focus}`,
    title,
    why,
    priority,
    lessons,
    ...(milestone ? { milestone } : {}),
  });
  const part = (partId: string, title: string, why: string) =>
    phase(
      title,
      why,
      { part: partId },
      { kind: 'checkpoint', partId, title: `${title} checkpoint` },
    );
  const path = (pathId: string, title: string, why: string) =>
    phase(title, why, { path: pathId }, exam(pathId, `${title} exam`));
  switch (focus) {
    case 'basics':
      return path('start-coding', 'Start coding', 'The ground every program stands on.');
    case 'web':
      return part('interfaces', 'Interfaces', 'The web, React and accessible design.');
    case 'typescript':
      return path('javascript-typescript', 'TypeScript', 'The language of the web, typed.');
    case 'python':
      return path('python', 'Python', 'Clean, typed Python, by hand.');
    case 'backend':
      return part('servers', 'Servers and data', 'APIs, databases, auth and testing.');
    case 'algorithms':
      return path('coding-rounds', 'Algorithms', 'The patterns behind most coding questions.');
    case 'ai':
      return path(
        'ai-engineering',
        'AI engineering',
        'Retrieval, agents and evaluations, built and measured.',
      );
    case 'systems':
      return part(
        'senior',
        'Senior engineer',
        'Scale, consistency and failure, and explaining the trade-offs.',
      );
    case 'interviews':
      return path(
        'interview-loop',
        'Interview skills',
        'Your stories, system design and closing well.',
      );
  }
}

/** The phases for a goal, in the order to work through them. */
function specs(answers: PlanAnswers, catalog: PlanCatalog): PhaseSpec[] {
  const { goal, level, language } = answers;
  const foundations: PhaseSpec = {
    id: 'foundations',
    title: 'First programs',
    why: 'Values, decisions, loops and functions: every program is built from these.',
    priority: 1,
    lessons: { path: 'start-coding' },
    milestone: exam('start-coding', 'Start coding exam'),
  };
  const firstLanguage: PhaseSpec = {
    id: 'language',
    title: language === 'python' ? 'Python properly' : 'TypeScript properly',
    why: 'The behaviour of the language, written by hand, the way reviewers and interviews expect.',
    priority: 2,
    lessons: { path: lang(language) },
    milestone: exam(lang(language), 'Language exam'),
  };
  const patterns: PhaseSpec = {
    id: 'patterns',
    title: 'Problem-solving patterns',
    why: 'Most coding questions are a handful of patterns. Recognise them and the code follows.',
    priority: 2,
    lessons: { path: 'coding-rounds' },
    milestone: exam('coding-rounds', 'Algorithms exam'),
  };

  const timedCheck: PhaseSpec = {
    id: 'check',
    title: 'Prove it under a clock',
    why: 'A timed test with the assistant off shows what came back and what did not.',
    priority: 3,
    tests: [{ key: 'demo', target: 80 }],
    milestone: { kind: 'test', key: 'demo', title: 'Your first test at 80%', target: 80 },
  };

  switch (goal) {
    case 'everything':
      // The course is written in a good order already: every part, one after another, each
      // closed by its checkpoint. A beginner starts on the path built for a first week.
      return [
        ...(level === 'new' ? [foundations] : []),
        ...catalog.parts.map((p, i): PhaseSpec => ({
          id: `part-${p.id}`,
          title: p.title,
          why: `Part ${i + 1} of ${catalog.parts.length}. It ends with a checkpoint on the whole part.`,
          priority: i + 2,
          lessons: { part: p.id },
          milestone: { kind: 'checkpoint', partId: p.id, title: `${p.title} checkpoint` },
        })),
      ];
    case 'refresh-specialise': {
      const focus = answers.focus ?? [];
      return [
        { ...firstLanguage, title: 'Back to the language, by hand', priority: 1 },
        { ...patterns, priority: 2 },
        ...(focus.length === 0 ? [timedCheck] : focus.map((f, i) => focusPhase(f, i + 3))),
      ];
    }
    case 'first-job':
      return [
        ...(level === 'new' ? [foundations] : []),
        ...(level !== 'pro' ? [firstLanguage] : []),
        {
          id: 'interfaces',
          title: 'Interfaces',
          why: 'The web, React and accessible design: the part of an app people see first.',
          priority: 2,
          lessons: { part: 'interfaces' },
          milestone: { kind: 'checkpoint', partId: 'interfaces', title: 'Interfaces checkpoint' },
        },
        {
          id: 'servers',
          title: 'Servers and data',
          why: 'APIs, databases and tests: what a junior role expects on day one.',
          priority: 3,
          lessons: { part: 'servers' },
          milestone: { kind: 'checkpoint', partId: 'servers', title: 'Servers checkpoint' },
        },
        { ...patterns, priority: 3 },
        {
          id: 'timed',
          title: 'Timed practice',
          why: 'The online test comes first in most hiring. Rehearse it until it is familiar.',
          priority: 4,
          tests: [
            { key: 'demo', target: 80 },
            { key: 'screen-a', target: 70 },
            { key: 'mock-a', target: 70 },
          ],
          milestone: { kind: 'test', key: 'mock-a', title: 'Practice test 1 at 70%', target: 70 },
        },
        {
          id: 'talking',
          title: 'The talking rounds',
          why: 'Behavioural questions, your stories and a design on a whiteboard.',
          priority: 5,
          lessons: { path: 'interview-loop' },
        },
      ];
    case 'from-zero':
      return [foundations, { ...firstLanguage, priority: 2 }, { ...patterns, priority: 3 }];
    case 'refresh':
      return [
        { ...firstLanguage, title: 'Back to the language, by hand', priority: 1 },
        { ...patterns, priority: 2 },
        timedCheck,
      ];
    case 'second-language':
      return [
        {
          id: 'second',
          title: language === 'python' ? 'TypeScript' : 'Python',
          why: 'You know how to program; this is the new syntax, idioms and traps.',
          priority: 1,
          lessons: { path: other(language) },
          milestone: exam(other(language), 'Language exam'),
        },
      ];
    case 'builder':
      return [
        ...(level === 'new' ? [foundations] : []),
        ...(level !== 'pro' ? [firstLanguage] : []),
        {
          id: 'interfaces',
          title: 'Interfaces',
          why: 'The web, React and accessible design: what users touch.',
          priority: 2,
          lessons: { part: 'interfaces' },
          milestone: { kind: 'checkpoint', partId: 'interfaces', title: 'Interfaces checkpoint' },
        },
        {
          id: 'servers',
          title: 'Servers and data',
          why: 'APIs, databases, auth and testing: what keeps the app honest.',
          priority: 3,
          lessons: { part: 'servers' },
          milestone: { kind: 'checkpoint', partId: 'servers', title: 'Servers checkpoint' },
        },
        {
          id: 'production',
          title: 'Production',
          why: 'Security, performance and deployment: what keeps it running.',
          priority: 4,
          lessons: { part: 'production' },
          milestone: { kind: 'checkpoint', partId: 'production', title: 'Production checkpoint' },
        },
      ];
    case 'ai-engineer':
      return [
        ...(level !== 'pro'
          ? [
              {
                ...firstLanguage,
                title: 'Python properly',
                lessons: { path: 'python' },
                milestone: exam('python', 'Python exam'),
              },
            ]
          : []),
        {
          id: 'ai',
          title: 'Build AI systems',
          why: 'A model client, retrieval, agents and evaluations: built, measured and explained.',
          priority: 1,
          lessons: { path: 'ai-engineering' },
          milestone: exam('ai-engineering', 'AI engineering exam'),
        },
      ];
    case 'interviews':
      return [
        {
          id: 'routine',
          title: 'The routine',
          why: 'Reviewers score how you work as much as the answer. Learn one routine and use it on every task.',
          priority: 1,
          lessons: { path: 'ai-coding-tests', stages: [0] },
        },
        {
          id: 'timed',
          title: 'Timed practice',
          why: 'The test is a skill in itself: the clock, the IDE, the hidden tests. Rehearse it until it is familiar.',
          priority: 1,
          tests: [
            { key: 'demo', target: 80 },
            { key: 'screen-a', target: 70 },
            { key: 'mock-a', target: 70 },
          ],
          milestone: { kind: 'test', key: 'mock-a', title: 'Practice test 1 at 70%', target: 70 },
        },
        { ...patterns, priority: 2 },
        {
          id: 'ai-rounds',
          title: 'The rest of the AI coding tests path',
          why: 'Task families, AI-assisted rounds and proofreading AI code.',
          priority: 3,
          lessons: { path: 'ai-coding-tests', stages: [1, 2, 3] },
          milestone: exam('ai-coding-tests', 'AI coding tests exam'),
        },
        {
          id: 'talking',
          title: 'The talking rounds',
          why: 'Behavioural questions, your stories and a design on a whiteboard.',
          priority: 3,
          lessons: { path: 'interview-loop' },
        },
        ...(level === 'some' ? [{ ...firstLanguage, priority: 4 }] : []),
      ];
    case 'senior':
      return [
        {
          id: 'loop',
          title: 'The interview loop',
          why: 'Your stories, system design and explaining trade-offs out loud.',
          priority: 1,
          lessons: { path: 'interview-loop' },
          milestone: exam('interview-loop', 'Interview skills exam'),
        },
        {
          id: 'design',
          title: 'System design in depth',
          why: 'The patterns behind the whiteboard: scale, consistency, failure.',
          priority: 2,
          lessons: { part: 'senior' },
          milestone: { kind: 'checkpoint', partId: 'senior', title: 'Senior checkpoint' },
        },
      ];
    case 'stay-sharp':
      return [
        {
          id: 'habit',
          title: 'Ten minutes a day',
          why: 'Practice keeps what you learnt; a weekly timed test keeps the speed.',
          priority: 1,
          habits: [
            { href: '/practise', title: 'Review what is due', minutes: 10, every: 'day' },
            { href: '/practise/online-test', title: 'One timed test', minutes: 60, every: 'week' },
          ],
        },
      ];
  }
}

function lessonsFor(spec: PhaseSpec, catalog: PlanCatalog): PlanItem[] {
  if (!spec.lessons) return [];
  const toItem = (l: PlanLesson): PlanItem => ({
    kind: 'lesson',
    id: l.id,
    title: l.title,
    minutes: l.minutes,
    ...(l.href ? { href: l.href } : {}),
  });
  if ('part' in spec.lessons) {
    const part = catalog.parts.find((p) => p.id === (spec.lessons as { part: string }).part);
    return part ? part.lessons.map(toItem) : [];
  }
  const { path: pathId, stages } = spec.lessons;
  const path = catalog.paths.find((p) => p.id === pathId);
  if (!path) return [];
  return path.stages
    .filter((_, i) => !stages || stages.includes(i))
    .flatMap((s) => s.lessons.map(toItem));
}

const itemMinutes = (items: readonly PlanItem[]) => items.reduce((sum, i) => sum + i.minutes, 0);

/** Whole weeks, at least one, from one YYYY-MM-DD date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function buildPlan(answers: PlanAnswers, catalog: PlanCatalog): Plan {
  const seen = new Set<string>();
  const phases: (Phase & { priority: number })[] = [];
  for (const spec of specs(answers, catalog)) {
    // A lesson appears once, in the first phase that asks for it.
    const items = [
      ...lessonsFor(spec, catalog).filter((item) => item.kind !== 'lesson' || !seen.has(item.id)),
      ...(spec.tests ?? []).flatMap((t): PlanItem[] => {
        const test = catalog.tests.find((c) => c.key === t.key);
        return test
          ? [
              {
                kind: 'test',
                key: test.key,
                title: test.title,
                minutes: test.minutes,
                target: t.target,
              },
            ]
          : [];
      }),
      ...(spec.habits ?? []).map((h): PlanItem => ({ kind: 'habit', ...h })),
    ];
    for (const item of items) if (item.kind === 'lesson') seen.add(item.id);
    if (items.length === 0) continue;
    phases.push({
      id: spec.id,
      title: spec.title,
      why: spec.why,
      items,
      priority: spec.priority,
      ...(spec.milestone ? { milestone: spec.milestone } : {}),
    });
  }

  // With a deadline, keep phases by priority until the time runs out; the rest become
  // "if time allows". The first phase always stays: a plan with nothing in it helps no one.
  let trimmed = false;
  if (answers.deadline) {
    // Counted in days, not rounded up to weeks: three days to go means three days of work.
    const days = Math.max(1, daysBetween(answers.since, answers.deadline));
    let budget = (days * answers.minutesPerWeek) / 7;
    const order = [...phases].sort((a, b) => a.priority - b.priority);
    const keep = new Set<string>();
    for (const [i, phase] of order.entries()) {
      const cost = itemMinutes(phase.items);
      if (i === 0 || cost <= budget) {
        keep.add(phase.id);
        budget -= cost;
      }
    }
    for (const phase of phases) {
      if (!keep.has(phase.id)) {
        phase.optional = true;
        trimmed = true;
      }
    }
  }

  // Priority only orders the trim; the plan itself does not carry it.
  const clean: Phase[] = phases.map((phase) => {
    const { priority, ...rest } = phase;
    void priority;
    return rest;
  });
  const copy = GOAL_COPY[answers.goal];
  return {
    goal: answers.goal,
    title: copy.title,
    summary: copy.who,
    phases: clean,
    minutes: itemMinutes(
      clean.filter((p) => !p.optional).flatMap((p) => p.items.filter((i) => i.kind !== 'habit')),
    ),
    trimmed,
  };
}

// ---- Progress and pace ----------------------------------------------------------------------

export interface PlanFacts {
  completedLessons: ReadonlySet<string>;
  /** Best score per online test, as a percentage. */
  bestTestScores: Readonly<Record<string, number>>;
  passedExams: ReadonlySet<string>;
}

export function itemDone(item: PlanItem, facts: PlanFacts): boolean {
  switch (item.kind) {
    case 'lesson':
      return facts.completedLessons.has(item.id);
    case 'test':
      return (facts.bestTestScores[item.key] ?? -1) >= item.target;
    case 'habit':
      return false;
  }
}

export function milestoneDone(milestone: Milestone, facts: PlanFacts): boolean {
  switch (milestone.kind) {
    case 'path-exam':
      return facts.passedExams.has(milestone.pathId);
    case 'test':
      return (facts.bestTestScores[milestone.key] ?? -1) >= milestone.target;
    case 'checkpoint':
      return false;
  }
}

export interface PhaseProgress {
  id: string;
  done: number;
  total: number;
  complete: boolean;
}

export interface PlanProgress {
  phases: PhaseProgress[];
  /** The next thing to do: the first unfinished item of the first unfinished phase. */
  next?: { phaseId: string; item: PlanItem };
  doneMinutes: number;
  /** Share of the counted minutes done, 0 to 1. */
  share: number;
}

export function planProgress(plan: Plan, facts: PlanFacts): PlanProgress {
  let doneMinutes = 0;
  const phases = plan.phases.map((phase) => {
    const counted = phase.items.filter((i) => i.kind !== 'habit');
    const done = counted.filter((i) => itemDone(i, facts));
    if (!phase.optional) doneMinutes += itemMinutes(done);
    return {
      id: phase.id,
      done: done.length,
      total: counted.length,
      complete: counted.length > 0 && done.length === counted.length,
    };
  });
  // The next step comes from the counted phases first; "if time allows" only after them.
  const pending = (optional: boolean) =>
    plan.phases
      .filter((phase) => Boolean(phase.optional) === optional)
      .flatMap((phase) =>
        phase.items
          .filter((item) => item.kind === 'habit' || !itemDone(item, facts))
          .map((item) => ({ phaseId: phase.id, item })),
      )[0];
  const next = pending(false) ?? pending(true);
  return {
    phases,
    ...(next ? { next } : {}),
    doneMinutes,
    share: plan.minutes === 0 ? 0 : Math.min(1, doneMinutes / plan.minutes),
  };
}

export type PaceStatus = 'no-deadline' | 'on-track' | 'behind' | 'ahead' | 'past';

export interface Pace {
  status: PaceStatus;
  /** Days until the deadline, when there is one. */
  daysLeft?: number;
  /** Minutes a day that finish the counted plan by the deadline. */
  minutesPerDay: number;
}

export function planPace(
  plan: Plan,
  answers: PlanAnswers,
  progress: PlanProgress,
  today: string,
): Pace {
  const perDay = Math.round(answers.minutesPerWeek / 7);
  if (!answers.deadline) return { status: 'no-deadline', minutesPerDay: perDay };
  const daysLeft = daysBetween(today, answers.deadline);
  if (daysLeft < 0) return { status: 'past', daysLeft, minutesPerDay: 0 };
  const total = Math.max(1, daysBetween(answers.since, answers.deadline));
  const elapsed = Math.min(total, Math.max(0, daysBetween(answers.since, today)));
  const expected = (plan.minutes * elapsed) / total;
  const remaining = Math.max(0, plan.minutes - progress.doneMinutes);
  const minutesPerDay = Math.ceil(remaining / Math.max(1, daysLeft));
  // A day's work either side counts as on track: nobody should feel behind after one quiet day.
  const slack = perDay;
  const status: PaceStatus =
    progress.doneMinutes + slack < expected
      ? 'behind'
      : progress.doneMinutes > expected + slack
        ? 'ahead'
        : 'on-track';
  return { status, daysLeft, minutesPerDay };
}
