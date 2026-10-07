/*
 * From a placement result to a path (LEARNING-SCIENCE.md B1, "Ending"): a written path when
 * one fits the area to work on, else a path built from that area's own lessons. Either way
 * the learner gets the first lesson worth taking and a draft to refine with Scout, both
 * without the lessons placement showed they know.
 */

import type { PlacementPathRule } from '@/core/content/placement-schema';
import type { Draft, DraftStage } from '@/core/planner/draft';

/** A built path stays a path, not the whole area: about a month at a steady pace. */
const MAX_BUILT_LESSONS = 25;

/**
 * True when placement showed every concept the lesson teaches. A lesson that names no
 * concept is never skipped: there is nothing to have shown.
 */
export function placedOut(
  concepts: readonly string[],
  isKnown: (concept: string) => boolean,
): boolean {
  return concepts.length > 0 && concepts.every(isKnown);
}

/** Below this, practice has shown an assumed concept is not known after all. */
const CONTRADICTED_BELOW = 0.4;

/**
 * What placement says the learner knows: an assumed concept, unless practice has since
 * answered it and mastery stayed low. Probes (B1, 4) keep placement honest this way.
 */
export function placementKnows(state: {
  readonly assumedConcepts: ReadonlySet<string>;
  readonly concepts: Readonly<
    Record<string, { readonly p: number; readonly attemptCount: number }>
  >;
}): (concept: string) => boolean {
  return (concept) => {
    if (!state.assumedConcepts.has(concept)) return false;
    const record = state.concepts[concept];
    return !record || record.attemptCount === 0 || record.p >= CONTRADICTED_BELOW;
  };
}

export interface RecommendInput {
  readonly focus: {
    readonly id: string;
    readonly title: string;
    readonly modules: readonly string[];
  };
  /** The focus area's level, 0 to 3. */
  readonly level: number;
  readonly rules: readonly PlacementPathRule[];
  readonly paths: readonly {
    readonly id: string;
    readonly name: string;
    readonly stages: readonly {
      readonly title: string;
      readonly why: string;
      readonly lessonIds: readonly string[];
    }[];
  }[];
  /** Every lesson in course order. */
  readonly lessons: readonly {
    readonly id: string;
    readonly moduleId: string;
    readonly concepts: readonly string[];
  }[];
  readonly moduleTitles: Readonly<Record<string, string>>;
  readonly isDone: (lessonId: string) => boolean;
  /** A concept placement showed and practice has not since contradicted. */
  readonly isKnown: (concept: string) => boolean;
}

export interface Recommendation {
  /** "path" is a written path; "built" a path made from the focus area's lessons. */
  readonly kind: 'path' | 'built';
  readonly pathId?: string;
  readonly firstLessonId?: string;
  /** Lessons on the path that placement showed the learner knows. */
  readonly skipped: readonly string[];
  readonly draft: Draft;
}

export function recommendPath(input: RecommendInput): Recommendation {
  const concepts = new Map(input.lessons.map((l) => [l.id, l.concepts]));
  const isPlacedOut = (id: string) => placedOut(concepts.get(id) ?? [], input.isKnown);
  const isOpen = (id: string) => !input.isDone(id) && !isPlacedOut(id);

  const rule = input.rules.find((r) => r.area === input.focus.id && input.level < r.below);
  const path = rule ? input.paths.find((p) => p.id === rule.path) : undefined;
  if (path) {
    const ids = path.stages.flatMap((s) => s.lessonIds);
    const first = ids.find(isOpen);
    if (first) {
      const stages: DraftStage[] = path.stages
        .map((s) => ({
          title: s.title,
          why: s.why,
          lessonIds: s.lessonIds.filter((id) => !isPlacedOut(id)),
        }))
        .filter((s) => s.lessonIds.length > 0);
      return {
        kind: 'path',
        pathId: path.id,
        firstLessonId: first,
        skipped: ids.filter(isPlacedOut),
        draft: {
          name: `${path.name}, from your level`,
          alternatives: [],
          summary: `${path.name} without the lessons your placement showed you know.`,
          stages,
        },
      };
    }
  }

  const inArea = input.lessons.filter((l) => input.focus.modules.includes(l.moduleId));
  const chosen = inArea.filter((l) => isOpen(l.id)).slice(0, MAX_BUILT_LESSONS);
  const stages: DraftStage[] = input.focus.modules
    .map((moduleId) => ({
      title: input.moduleTitles[moduleId] ?? moduleId,
      why: 'Where your placement found the next things to learn.',
      lessonIds: chosen.filter((l) => l.moduleId === moduleId).map((l) => l.id),
    }))
    .filter((s) => s.lessonIds.length > 0);
  return {
    kind: 'built',
    ...(chosen[0] ? { firstLessonId: chosen[0].id } : {}),
    skipped: inArea.filter((l) => !input.isDone(l.id) && isPlacedOut(l.id)).map((l) => l.id),
    draft: {
      name: `${input.focus.title}, from your level`,
      alternatives: [],
      summary: `${input.focus.title}, starting where your placement left off.`,
      stages,
    },
  };
}
