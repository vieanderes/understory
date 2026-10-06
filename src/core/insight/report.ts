import { PATH_EXAM_MINUTES, pathExamPassed } from '../exam';
import { GOAL_XP_BY_TIER, weekKey } from '../gamification';
import type { MasteryState } from '../mastery';
import { percent, scoreTallies } from '../online-test/score';
import type { CatalogFile, CatalogLesson } from '../practice';
import { INTEREST_COPY, INTERESTS, type Interest } from '../profile/interests';
import type { ProgressState } from '../progress';
import {
  conceptViews,
  DEFAULT_GOAL_TIER,
  NEARLY_FORGOTTEN_BELOW,
  type ConceptView,
} from './overview';
import { partProgress, type ConceptStateOf } from './parts';
import type { ProgressScope } from './scope';
import { isLessonDone } from './time';

/*
 * The Progress page's read side: where a learner stands, what they did, what is weak and
 * what they have not started, for one scope (scope.ts). Every figure is derived from the
 * folded log, the catalogue and the clock at the moment of looking, never stored (law 3).
 */

const DAY_MS = 86_400_000;

/** How many weeks the activity chart shows. Two months is long enough to see a habit. */
export const ACTIVITY_WEEKS = 8;

/** A test whose best is under this is offered again. */
export const RETEST_BELOW = 50;

/** An exam is not hard-timed; past this a tab was left open, not worked in. */
const EXAM_MINUTES_CAP = PATH_EXAM_MINUTES * 3;

/** "Work on next" stays a short list. */
export const WORK_ON_LIMIT = 5;

const STARTED: ReadonlySet<MasteryState> = new Set([
  'introduced',
  'practised',
  'solid',
  'fluent',
  'gap',
]);
const HELD: ReadonlySet<MasteryState> = new Set(['solid', 'fluent']);

const lessonHref = (lesson: CatalogLesson) => `/learn/${lesson.moduleSlug}/${lesson.slug}`;
const testHref = (id: string) => `/practise/online-test/${id}`;

function practiceHref(topic: Interest | undefined): string {
  return topic ? `/practise/session/10?topics=${topic}` : '/practise/session/10';
}

/** The interest a chapter belongs to, so a practice session can be narrowed to it. */
function topicOf(scope: ProgressScope, moduleId: string): Interest | undefined {
  return scope.topic ?? INTERESTS.find((id) => INTEREST_COPY[id].modules.includes(moduleId));
}

const inScope = (scope: ProgressScope, views: readonly ConceptView[]) => {
  const ids = new Set(scope.conceptIds);
  return views.filter((v) => ids.has(v.id));
};

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export interface WeekActivity {
  readonly weekKey: string;
  /** The Monday the week starts on, YYYY-MM-DD. */
  readonly start: string;
  /** XP from everything, since XP is not kept per lesson. */
  readonly xp: number;
  /** Estimated: lesson minutes, plus the time of timed tests and exams in scope. */
  readonly minutes: number;
  readonly lessons: number;
  readonly met: boolean;
  readonly current: boolean;
}

export interface Activity {
  readonly weeks: readonly WeekActivity[];
  readonly goal: number;
  /** Weeks of those shown whose goal was met. */
  readonly met: number;
  /** Any week holds XP or time, so there is something to chart. */
  readonly active: boolean;
}

function mondayOf(localDate: string): Date {
  const date = new Date(`${localDate}T12:00:00Z`);
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return new Date(date.getTime() - (isoDay - 1) * DAY_MS);
}

const minutesBetween = (from: string, to: string, cap: number) =>
  Math.min(cap, Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000)));

export function weeklyActivity(input: {
  readonly catalog: CatalogFile;
  readonly state: ProgressState;
  readonly scope: ProgressScope;
  readonly today: string;
}): Activity {
  const { catalog, state, scope, today } = input;
  const goal = GOAL_XP_BY_TIER[state.goalTier ?? DEFAULT_GOAL_TIER];
  const monday = mondayOf(today);
  const starts = Array.from({ length: ACTIVITY_WEEKS }, (_, i) =>
    new Date(monday.getTime() - (ACTIVITY_WEEKS - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10),
  );
  const byWeek = new Map(
    starts.map((start) => [weekKey(start), { start, xp: 0, minutes: 0, lessons: 0 }]),
  );
  const at = (localDate: string) => byWeek.get(weekKey(localDate));

  for (const [date, xp] of Object.entries(state.xpByLocalDate)) {
    const week = at(date);
    if (week) week.xp += xp;
  }
  for (const id of scope.lessonIds) {
    const on = state.lessonCompletedOn[id];
    const week = on ? at(on) : undefined;
    if (!week) continue;
    week.lessons += 1;
    week.minutes += catalog.lessons[id]?.minutes ?? 0;
  }
  if (scope.timedTests) {
    for (const sitting of state.onlineTests) {
      const week = at(sitting.localDate);
      if (week)
        week.minutes += minutesBetween(sitting.startedAt, sitting.submittedAt, sitting.minutes);
    }
  }
  for (const pathId of scope.examPathIds) {
    for (const sitting of state.pathExams[pathId] ?? []) {
      const week = at(sitting.localDate);
      if (week)
        week.minutes += minutesBetween(sitting.startedAt, sitting.finishedAt, EXAM_MINUTES_CAP);
    }
  }

  const thisWeek = weekKey(today);
  const weeks = [...byWeek].map(([key, w]) => ({
    weekKey: key,
    ...w,
    // A goal is never met by doing nothing, whatever the tier.
    met: w.xp > 0 && w.xp >= goal,
    current: key === thisWeek,
  }));
  return {
    weeks,
    goal,
    met: weeks.filter((w) => w.met).length,
    active: weeks.some((w) => w.xp > 0 || w.minutes > 0),
  };
}

// ---------------------------------------------------------------------------
// Recall and mastery
// ---------------------------------------------------------------------------

export interface RecallHealth {
  /** Concepts with a card due now. */
  readonly due: number;
  /** Not due, but a gap or under the nearly-forgotten line. */
  readonly fading: number;
  readonly holding: number;
}

/** Each concept with reviewed cards counts once, in the first bucket that fits. */
export function recallHealth(views: readonly ConceptView[], scope: ProgressScope): RecallHealth {
  let due = 0;
  let fading = 0;
  let holding = 0;
  for (const v of inScope(scope, views)) {
    if (v.recall === null && v.state !== 'gap') continue;
    if (v.dueNow) due += 1;
    else if (v.state === 'gap' || (v.recall ?? 0) < NEARLY_FORGOTTEN_BELOW) fading += 1;
    else holding += 1;
  }
  return { due, fading, holding };
}

export interface MasteryCount {
  readonly total: number;
  readonly started: number;
  readonly solid: number;
  readonly gaps: number;
}

export interface ChapterMastery extends MasteryCount {
  readonly id: string;
  readonly title: string;
  readonly number: number;
}

export interface PartMastery extends MasteryCount {
  /** A part id, or `woven` for the chapters no part owns. */
  readonly id: string;
  readonly title: string;
  /** The part's place in the course, or null for the woven chapters. */
  readonly number: number | null;
  readonly chapters: readonly ChapterMastery[];
}

function countOf(views: readonly ConceptView[]): MasteryCount {
  return {
    total: views.length,
    started: views.filter((v) => STARTED.has(v.state)).length,
    solid: views.filter((v) => HELD.has(v.state)).length,
    gaps: views.filter((v) => v.state === 'gap').length,
  };
}

const WOVEN_TITLE = 'Woven through the course';

export function masteryByPart(
  catalog: CatalogFile,
  scope: ProgressScope,
  views: readonly ConceptView[],
): PartMastery[] {
  const scoped = inScope(scope, views);
  const owned = new Set(catalog.parts.flatMap((p) => p.modules));
  const groups = [
    ...catalog.parts.map((part, i) => ({
      id: part.id,
      title: part.title,
      number: (i + 1) as number | null,
      modules: part.modules,
    })),
    {
      id: 'woven',
      title: WOVEN_TITLE,
      number: null,
      modules: catalog.modules.map((m) => m.id).filter((id) => !owned.has(id)),
    },
  ];
  return groups.flatMap((group) => {
    const chapters = group.modules.flatMap((moduleId) => {
      const chapter = catalog.modules.find((m) => m.id === moduleId);
      const concepts = scoped.filter((v) => v.moduleId === moduleId);
      if (!chapter || concepts.length === 0) return [];
      return [
        { id: chapter.id, title: chapter.title, number: chapter.number, ...countOf(concepts) },
      ];
    });
    if (chapters.length === 0) return [];
    const concepts = scoped.filter((v) => group.modules.includes(v.moduleId));
    return [
      { id: group.id, title: group.title, number: group.number, chapters, ...countOf(concepts) },
    ];
  });
}

// ---------------------------------------------------------------------------
// Tests, exams, test-outs, capstones
// ---------------------------------------------------------------------------

export interface TestSitting {
  readonly attemptId: string;
  readonly testKey: string;
  readonly title: string;
  /** Whole per cent, rounded down as the platform does. */
  readonly score: number;
  readonly on: string;
  readonly guided: boolean;
}

export interface TestRecord {
  readonly testKey: string;
  readonly title: string;
  readonly best: number;
  readonly last: number;
  readonly sittings: number;
  /** Scores in the order they were sat. */
  readonly trend: readonly number[];
  readonly href: string;
}

export interface TestCatalogEntry {
  readonly id: string;
  readonly title: string;
}

export interface CodingTests {
  /** Newest first. */
  readonly sittings: readonly TestSitting[];
  readonly byTest: readonly TestRecord[];
  readonly neverSat: readonly (TestCatalogEntry & { readonly href: string })[];
}

export function codingTests(state: ProgressState, tests: readonly TestCatalogEntry[]): CodingTests {
  const titleOf = new Map(tests.map((t) => [t.id, t.title]));
  const ordered = [...state.onlineTests].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const sittings = ordered.map((a) => ({
    attemptId: a.attemptId,
    testKey: a.testKey,
    title: titleOf.get(a.testKey) ?? a.title,
    score: percent(scoreTallies(a.tasks)),
    on: a.localDate,
    guided: a.guided ?? false,
  }));
  const keys = [...new Set(sittings.map((s) => s.testKey))];
  const byTest = keys.map((testKey) => {
    const mine = sittings.filter((s) => s.testKey === testKey);
    const trend = mine.map((s) => s.score);
    return {
      testKey,
      title: (mine.at(-1) as TestSitting).title,
      best: Math.max(...trend),
      last: trend.at(-1) as number,
      sittings: mine.length,
      trend,
      href: testHref(testKey),
    };
  });
  const sat = new Set(keys);
  return {
    sittings: sittings.reverse(),
    byTest,
    neverSat: tests.filter((t) => !sat.has(t.id)).map((t) => ({ ...t, href: testHref(t.id) })),
  };
}

export interface ExamRecord {
  readonly pathId: string;
  readonly name: string;
  readonly sittings: number;
  readonly best: number;
  readonly passed: boolean;
  readonly lastOn: string;
  readonly href: string;
}

export function examRecords(
  state: ProgressState,
  scope: ProgressScope,
  pathNames: Readonly<Record<string, string>>,
): ExamRecord[] {
  return scope.examPathIds.flatMap((pathId) => {
    const sittings = state.pathExams[pathId] ?? [];
    const last = sittings.at(-1);
    if (!last) return [];
    const best = Math.max(...sittings.map((s) => s.right / s.total));
    return [
      {
        pathId,
        name: pathNames[pathId] ?? pathId,
        sittings: sittings.length,
        best: percent(best),
        passed: sittings.some((s) => pathExamPassed(s.right, s.total)),
        lastOn: last.localDate,
        href: `/practise/exam/${pathId}`,
      },
    ];
  });
}

export interface TestOutRecord {
  /** The part or chapter tested out of. */
  readonly id: string;
  readonly title: string;
  readonly sittings: number;
  readonly best: number;
  readonly passed: boolean;
}

export function testOutRecords(
  state: ProgressState,
  catalog: CatalogFile,
  scope: ProgressScope,
): TestOutRecord[] {
  const modules = new Set(scope.lessonIds.map((id) => catalog.lessons[id]?.moduleId));
  const candidates = [
    ...catalog.parts.filter((p) => scope.partIds.includes(p.id)),
    ...catalog.modules.filter((m) => modules.has(m.id)),
  ];
  return candidates.flatMap(({ id, title }) => {
    const sittings = state.testOuts[id] ?? [];
    if (sittings.length === 0) return [];
    return [
      {
        id,
        title,
        sittings: sittings.length,
        best: percent(Math.max(...sittings.map((s) => s.score))),
        passed: sittings.some((s) => s.passed),
      },
    ];
  });
}

export interface CapstoneRecord {
  readonly partId: string;
  readonly title: string;
  readonly built: boolean;
  /** A decision record is written for it. */
  readonly written: boolean;
  /** Every lesson of the part is done and the capstone is not built yet. */
  readonly ready: boolean;
  readonly href: string;
}

export function capstoneRecords(
  catalog: CatalogFile,
  state: ProgressState,
  scope: ProgressScope,
): CapstoneRecord[] {
  return catalog.parts
    .filter((part) => scope.partIds.includes(part.id))
    .map((part) => {
      const built = state.completedCapstones.has(part.id);
      const complete = partProgress(part, state, () => 'unseen').complete;
      return {
        partId: part.id,
        title: part.capstone.title,
        built,
        written: part.id in state.capstoneAdrs,
        ready: complete && !built,
        href: `/learn#part-${part.id}`,
      };
    });
}

export interface ChapterToStart {
  readonly id: string;
  readonly title: string;
  readonly lessons: number;
  readonly minutes: number;
  /** The chapter's first lesson in scope. */
  readonly href: string;
}

export function chaptersNotStarted(
  catalog: CatalogFile,
  state: ProgressState,
  scope: ProgressScope,
): ChapterToStart[] {
  const isDone = isLessonDone(state, catalog.parts);
  const order = [...new Set(scope.lessonIds.map((id) => catalog.lessons[id]?.moduleId))];
  const chapters = catalog.modules
    .filter((m) => order.includes(m.id))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return chapters.flatMap((chapter) => {
    const lessons = scope.lessonIds.flatMap((id) => {
      const lesson = catalog.lessons[id];
      return lesson?.moduleId === chapter.id ? [{ id, lesson }] : [];
    });
    const first = lessons[0];
    if (!first || lessons.some(({ id }) => isDone(id))) return [];
    return [
      {
        id: chapter.id,
        title: chapter.title,
        lessons: lessons.length,
        minutes: lessons.reduce((sum, { lesson }) => sum + lesson.minutes, 0),
        href: lessonHref(first.lesson),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Work on next
// ---------------------------------------------------------------------------

export type WorkKind =
  'gaps' | 'due' | 'lesson' | 'exam' | 'checkpoint' | 'weak' | 'retest' | 'test' | 'chapter';

/** One thing to do, with what the screen needs to say why. Copy lives with the screen. */
export interface WorkItem {
  readonly kind: WorkKind;
  /** What it is: a concept, lesson, test, part or chapter title. */
  readonly title: string;
  readonly href: string;
  /** Gaps and reviews due: how many. */
  readonly count?: number;
  /** Gaps: the concepts, first few. */
  readonly names?: readonly string[];
  /** Weak: mastery, 0..1. */
  readonly mastery?: number;
  /** A lesson or chapter: estimated minutes. */
  readonly minutes?: number;
  /** A test sat before: its best, whole per cent. */
  readonly best?: number;
  /** A lesson: nothing in scope is done yet, so this is where it begins. */
  readonly first?: boolean;
}

export interface WorkOnInput {
  readonly catalog: CatalogFile;
  readonly state: ProgressState;
  readonly scope: ProgressScope;
  readonly views: readonly ConceptView[];
  readonly tests: readonly TestCatalogEntry[];
}

/**
 * The few things most worth doing in scope, most urgent first: what is being lost, what is
 * due, the next lesson, then what closes a stretch, what is weak, and what is untouched.
 */
export function workOn(input: WorkOnInput): WorkItem[] {
  const { catalog, state, scope, tests } = input;
  const views = inScope(scope, input.views);
  const isDone = isLessonDone(state, catalog.parts);
  const items: WorkItem[] = [];

  const gaps = views.filter((v) => v.state === 'gap');
  const firstGap = gaps[0];
  if (firstGap) {
    items.push({
      kind: 'gaps',
      title: firstGap.title,
      href: practiceHref(topicOf(scope, firstGap.moduleId)),
      count: gaps.length,
      names: gaps.slice(0, 3).map((v) => v.title),
    });
  }

  const due = views.filter((v) => v.dueNow && v.state !== 'gap');
  const firstDue = due[0];
  if (firstDue) {
    items.push({
      kind: 'due',
      title: firstDue.title,
      href: practiceHref(topicOf(scope, firstDue.moduleId)),
      count: due.length,
    });
  }

  const nextId = scope.lessonIds.find((id) => !isDone(id));
  const next = nextId ? catalog.lessons[nextId] : undefined;
  if (next) {
    items.push({
      kind: 'lesson',
      title: next.title,
      href: lessonHref(next),
      minutes: next.minutes,
      first: !scope.lessonIds.some(isDone),
    });
  }

  const pathExam = scope.kind === 'path' ? scope.examPathIds[0] : undefined;
  if (
    pathExam &&
    !next &&
    !(state.pathExams[pathExam] ?? []).some((s) => pathExamPassed(s.right, s.total))
  ) {
    items.push({ kind: 'exam', title: scope.label, href: `/practise/exam/${pathExam}` });
  }

  const stateOf: ConceptStateOf = (id) => input.views.find((v) => v.id === id)?.state ?? 'unseen';
  for (const part of catalog.parts.filter((p) => scope.partIds.includes(p.id))) {
    const progress = partProgress(part, state, stateOf);
    if (progress.complete && progress.conceptsSolid < progress.conceptsTotal) {
      items.push({
        kind: 'checkpoint',
        title: part.title,
        href: `/practise/checkpoint/${part.id}`,
      });
    }
  }

  const weak = views
    .filter((v) => (v.state === 'practised' || v.state === 'introduced') && !v.dueNow)
    .sort((a, b) => a.mastery - b.mastery);
  const revisits = new Set<string>();
  for (const v of weak) {
    if (revisits.size === 2) break;
    const teaching =
      scope.lessonIds.find((id) => catalog.lessons[id]?.concepts.includes(v.id)) ??
      Object.keys(catalog.lessons).find((id) => catalog.lessons[id]?.concepts.includes(v.id));
    const lesson = teaching ? catalog.lessons[teaching] : undefined;
    const href = lesson ? lessonHref(lesson) : practiceHref(topicOf(scope, v.moduleId));
    // Two weak concepts of one lesson are one thing to do.
    if (revisits.has(href)) continue;
    revisits.add(href);
    items.push({ kind: 'weak', title: v.title, href, mastery: v.mastery });
  }

  if (scope.timedTests) {
    const record = codingTests(state, tests);
    const retest = record.byTest
      .filter((t) => t.best < RETEST_BELOW)
      .sort((a, b) => a.best - b.best)[0];
    if (retest)
      items.push({ kind: 'retest', title: retest.title, href: retest.href, best: retest.best });
    const fresh = record.neverSat[0];
    if (fresh) items.push({ kind: 'test', title: fresh.title, href: fresh.href });
  }

  const chapter = chaptersNotStarted(catalog, state, scope).find((c) => c.id !== next?.moduleId);
  if (chapter) {
    items.push({
      kind: 'chapter',
      title: chapter.title,
      href: chapter.href,
      minutes: chapter.minutes,
    });
  }

  return items.slice(0, WORK_ON_LIMIT);
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export interface ProgressReportInput {
  readonly catalog: CatalogFile;
  readonly state: ProgressState;
  readonly now: Date;
  readonly today: string;
  readonly scope: ProgressScope;
  /** The timed tests on offer, in the order the course recommends them. */
  readonly tests: readonly TestCatalogEntry[];
  readonly pathNames: Readonly<Record<string, string>>;
}

export interface ProgressReport {
  /** The learner has done anything at all, in any scope. */
  readonly started: boolean;
  readonly lessons: { readonly done: number; readonly total: number; readonly minutesLeft: number };
  readonly concepts: MasteryCount;
  readonly views: readonly ConceptView[];
  readonly recall: RecallHealth;
  readonly activity: Activity;
  readonly weeks: readonly WeekActivity[];
  readonly mastery: readonly PartMastery[];
  readonly tests: CodingTests;
  readonly exams: readonly ExamRecord[];
  readonly testOuts: readonly TestOutRecord[];
  readonly capstones: readonly CapstoneRecord[];
  readonly notStarted: readonly ChapterToStart[];
  readonly workOn: readonly WorkItem[];
  /** The page's one primary action: the first thing to work on. */
  readonly next: WorkItem | undefined;
}

const NO_TESTS: CodingTests = { sittings: [], byTest: [], neverSat: [] };

export function progressReport(input: ProgressReportInput): ProgressReport {
  const { catalog, state, now, today, scope, tests } = input;
  const views = conceptViews(catalog, state, now);
  const isDone = isLessonDone(state, catalog.parts);
  const left = scope.lessonIds.filter((id) => !isDone(id));
  const activity = weeklyActivity({ catalog, state, scope, today });
  const items = workOn({ catalog, state, scope, views, tests });
  return {
    started:
      state.completedLessons.size > 0 ||
      state.placementsCompleted > 0 ||
      Object.keys(state.concepts).length > 0 ||
      Object.keys(state.cards).length > 0 ||
      state.onlineTests.length > 0 ||
      Object.keys(state.pathExams).length > 0,
    lessons: {
      done: scope.lessonIds.length - left.length,
      total: scope.lessonIds.length,
      minutesLeft: left.reduce((sum, id) => sum + (catalog.lessons[id]?.minutes ?? 0), 0),
    },
    concepts: countOf(inScope(scope, views)),
    views,
    recall: recallHealth(views, scope),
    activity,
    weeks: activity.weeks,
    mastery: masteryByPart(catalog, scope, views),
    tests: scope.timedTests ? codingTests(state, tests) : NO_TESTS,
    exams: examRecords(state, scope, input.pathNames),
    testOuts: testOutRecords(state, catalog, scope),
    capstones: capstoneRecords(catalog, state, scope),
    notStarted: chaptersNotStarted(catalog, state, scope),
    workOn: items,
    next: items[0],
  };
}
