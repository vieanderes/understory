import { lessonIndex, type LessonEntry, type PlannerCourse } from './course';
import { cleanPathName } from './name';
import type { PathBlock } from './protocol';

/*
 * A draft path: what Scout proposed, checked against the course, and then whatever the
 * learner changed by hand. Scout sees the draft with every turn, so it refines what the
 * learner sees rather than what it first wrote.
 *
 * Everything shown about a draft (minutes, weeks, gaps) is derived here from lesson ids and
 * the course, never taken from the model: a model can miscount, the course cannot.
 */

export interface DraftStage {
  title: string;
  why: string;
  lessonIds: string[];
}

export interface Draft {
  name: string;
  alternatives: string[];
  summary: string;
  minutesPerWeek?: number;
  deadline?: string;
  stages: DraftStage[];
}

export interface ResolvedDraft {
  draft: Draft;
  /** Lesson ids Scout gave that are not in the course, or came twice. */
  dropped: number;
}

/** Scout's block, made safe: known lessons only, each once, no empty stages. */
export function draftFromBlock(block: PathBlock, course: PlannerCourse): ResolvedDraft {
  const index = lessonIndex(course);
  const seen = new Set<string>();
  let dropped = 0;
  const stages: DraftStage[] = [];
  for (const stage of block.stages) {
    const lessonIds: string[] = [];
    for (const id of stage.lessons) {
      if (!index.has(id) || seen.has(id)) {
        dropped += 1;
        continue;
      }
      seen.add(id);
      lessonIds.push(id);
    }
    if (lessonIds.length > 0) stages.push({ title: stage.title, why: stage.why, lessonIds });
  }
  const name = cleanPathName(block.name);
  const alternatives = [...new Set(block.alternatives.map(cleanPathName))].filter(
    (n) => n !== name,
  );
  return {
    draft: {
      name,
      alternatives,
      summary: block.summary,
      ...(block.minutesPerWeek ? { minutesPerWeek: block.minutesPerWeek } : {}),
      ...(block.deadline ? { deadline: block.deadline } : {}),
      stages,
    },
    dropped,
  };
}

export const draftLessonIds = (draft: Pick<Draft, 'stages'>): string[] =>
  draft.stages.flatMap((s) => s.lessonIds);

/** A prerequisite the path leaves out and the learner has not done. Advice, never a lock. */
export interface Gap {
  lessonId: string;
  neededBy: string[];
}

/** A prerequisite that is in the path, but after the lesson that builds on it. */
export interface OrderIssue {
  lessonId: string;
  prerequisiteId: string;
}

export interface DraftFacts {
  lessons: number;
  minutes: number;
  /** Lessons already completed. They stay in the path and count as done. */
  done: number;
  minutesLeft: number;
  gaps: Gap[];
  orderIssues: OrderIssue[];
}

export function draftFacts(
  draft: Pick<Draft, 'stages'>,
  course: PlannerCourse,
  completed: ReadonlySet<string>,
): DraftFacts {
  const index = lessonIndex(course);
  const ids = draftLessonIds(draft).filter((id) => index.has(id));
  const position = new Map(ids.map((id, i) => [id, i]));
  let minutes = 0;
  let minutesLeft = 0;
  let done = 0;
  const gaps = new Map<string, string[]>();
  const orderIssues: OrderIssue[] = [];
  for (const [i, id] of ids.entries()) {
    const { lesson } = index.get(id) as LessonEntry;
    minutes += lesson.minutes;
    if (completed.has(id)) done += 1;
    else minutesLeft += lesson.minutes;
    for (const pre of lesson.prerequisites) {
      if (!index.has(pre) || completed.has(pre)) continue;
      const at = position.get(pre);
      if (at === undefined) gaps.set(pre, [...(gaps.get(pre) ?? []), id]);
      else if (at > i) orderIssues.push({ lessonId: id, prerequisiteId: pre });
    }
  }
  return {
    lessons: ids.length,
    minutes,
    done,
    minutesLeft,
    gaps: [...gaps].map(([lessonId, neededBy]) => ({ lessonId, neededBy })),
    orderIssues,
  };
}

// ---- Edits by hand ---------------------------------------------------------------------------

export function removeLesson(draft: Draft, lessonId: string): Draft {
  return {
    ...draft,
    stages: draft.stages
      .map((s) => ({ ...s, lessonIds: s.lessonIds.filter((id) => id !== lessonId) }))
      .filter((s) => s.lessonIds.length > 0),
  };
}

export function removeStage(draft: Draft, stageIndex: number): Draft {
  return { ...draft, stages: draft.stages.filter((_, i) => i !== stageIndex) };
}

export function renameDraft(draft: Draft, name: string): Draft {
  return { ...draft, name: cleanPathName(name) };
}

/** How many times the gap-filling and reordering loops may pass; prerequisites are shallow. */
const MAX_PASSES = 50;

/**
 * Adds every missing prerequisite, and theirs, each just before the first lesson that needs
 * it, in that lesson's stage. Lessons already done are not added: the learner knows them.
 */
export function addGaps(
  draft: Draft,
  course: PlannerCourse,
  completed: ReadonlySet<string>,
): Draft {
  let next = draft;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const { gaps } = draftFacts(next, course, completed);
    if (gaps.length === 0) break;
    for (const gap of gaps) next = insertBefore(next, gap.lessonId, gap.neededBy[0] as string);
  }
  return next;
}

/** Moves each prerequisite to just before the first lesson in the path that builds on it. */
export function fixOrder(
  draft: Draft,
  course: PlannerCourse,
  completed: ReadonlySet<string>,
): Draft {
  let next = draft;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const [issue] = draftFacts(next, course, completed).orderIssues;
    if (!issue) break;
    next = insertBefore(
      removeLesson(next, issue.prerequisiteId),
      issue.prerequisiteId,
      issue.lessonId,
    );
  }
  return next;
}

function insertBefore(draft: Draft, lessonId: string, beforeId: string): Draft {
  return {
    ...draft,
    stages: draft.stages.map((s) => {
      const at = s.lessonIds.indexOf(beforeId);
      if (at < 0) return s;
      return { ...s, lessonIds: [...s.lessonIds.slice(0, at), lessonId, ...s.lessonIds.slice(at)] };
    }),
  };
}
