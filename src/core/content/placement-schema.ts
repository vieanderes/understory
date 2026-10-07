import * as z from '@/core/zod';
import type { Issue } from './catalog';
import type {
  CompiledBugHuntStep,
  CompiledMultipleChoiceStep,
  CompiledPredictStep,
} from './compiled';
import { bugHuntStepSchema, multipleChoiceStepSchema, predictStepSchema } from './schema';

/*
 * Placement (docs/LEARNING-SCIENCE.md B1). The course is measured area by area, because
 * one staircase over the whole course can only measure one skill, and the course holds
 * several that do not move together: someone strong in React can be new to Python.
 *
 * Each area covers a few modules and has three levels, Foundations, Working and
 * Advanced. A level holds alternative items, so a second attempt, or the longer check of
 * one area, meets different snippets at the same height.
 *
 * What a pass lets the course assume is not written by hand: it is the concepts of the
 * lessons the level's items come from (`assumedByLevel`). A hand-written list drifts
 * towards claiming whole chapters from one answer; this one claims what was tested.
 *
 * An item is an ordinary lesson step, so the player, the graders and the compiler are the
 * ones lessons already use. Only the three formats that read in under 45 seconds are
 * allowed: predict-output, multiple-choice and bug-hunt.
 */

export const PLACEMENT_SCHEMA = 2;
export const PLACEMENT_LEVELS = 3;
/** The one-area check asks up to two items per level, and a retake starts elsewhere. */
export const MIN_ITEMS_PER_LEVEL = 3;

/** Matches `moduleSchema.id` in schema.ts: one lowercase word, for example "js". */
const placementModuleId = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, 'A module id is one lowercase word, for example "js".');

/** Same rule as a module id, so an area can share its id with the course part it mirrors. */
const placementAreaId = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, 'An area id is one lowercase word, for example "servers".');

export const placementItemSchema = z.discriminatedUnion('type', [
  predictStepSchema,
  multipleChoiceStepSchema,
  // A placement item is answered in one tap of a line and one reason: no verify follow-up.
  bugHuntStepSchema.omit({ verify: true }),
]);

export const placementLevelSchema = z.strictObject({
  level: z.int().min(1).max(PLACEMENT_LEVELS).describe('1 Foundations, 2 Working, 3 Advanced.'),
  items: z
    .array(placementItemSchema)
    .min(MIN_ITEMS_PER_LEVEL, `A level holds at least ${MIN_ITEMS_PER_LEVEL} alternative items.`),
});

export const placementAreaSchema = z.strictObject({
  id: placementAreaId,
  title: z.string().min(1).describe('As the results screen names it, for example "Servers and data".'),
  /** The course part this area mirrors, so an advanced result can offer its test-out. */
  part: placementAreaId.optional(),
  modules: z.array(placementModuleId).min(1).describe('The modules this area speaks for.'),
  levels: z
    .array(placementLevelSchema)
    .length(PLACEMENT_LEVELS, `An area has exactly ${PLACEMENT_LEVELS} levels.`),
});

/**
 * Which written path fits a learner whose weakest area is `area`, while that area is below
 * `below`. The first rule that fits wins. An area with no rule gets a path built from its
 * own lessons.
 */
export const placementPathRuleSchema = z.strictObject({
  area: placementAreaId,
  below: z.int().min(1).max(PLACEMENT_LEVELS),
  path: z.string().regex(/^[a-z0-9-]+$/, 'A path id, as in content/tracks/<id>.yaml.'),
});

export const placementFileSchema = z.strictObject({
  schema: z.literal(PLACEMENT_SCHEMA),
  areas: z.array(placementAreaSchema).min(1),
  paths: z.array(placementPathRuleSchema),
});

export type PlacementItem = z.infer<typeof placementItemSchema>;
export type PlacementLevel = z.infer<typeof placementLevelSchema>;
export type PlacementArea = z.infer<typeof placementAreaSchema>;
export type PlacementPathRule = z.infer<typeof placementPathRuleSchema>;
export type PlacementFile = z.infer<typeof placementFileSchema>;

// ---------------------------------------------------------------------------
// The compiled shapes, in the bundle at `placement.json`
// ---------------------------------------------------------------------------

export type CompiledPlacementItem =
  | CompiledPredictStep
  | CompiledMultipleChoiceStep
  | Omit<CompiledBugHuntStep, 'verify'>;

export interface CompiledPlacementLevel {
  level: number;
  /** Derived at build time by `assumedByLevel`: what a pass lets the course assume. */
  concepts: string[];
  items: CompiledPlacementItem[];
}

export interface CompiledPlacementArea {
  id: string;
  title: string;
  part?: string;
  modules: string[];
  levels: CompiledPlacementLevel[];
}

export interface CompiledPlacementFile {
  schema: typeof PLACEMENT_SCHEMA;
  areas: CompiledPlacementArea[];
  paths: PlacementPathRule[];
}

// ---------------------------------------------------------------------------
// Checks that need the rest of the content
// ---------------------------------------------------------------------------

/** A lesson as placement needs it: its module and the concepts it teaches. */
export interface PlacementLessonRef {
  readonly moduleId: string;
  readonly concepts: readonly string[];
}

/** The modules of the course, in course order, with the concept ids each one owns. */
export interface PlacementWorld {
  readonly modules: readonly { readonly id: string; readonly concepts: readonly string[] }[];
  /** Every lesson, in course order. */
  readonly lessons: readonly PlacementLessonRef[];
  readonly parts: readonly string[];
  readonly paths: readonly string[];
}

/**
 * What passing each level lets the course assume: the concepts of every lesson, in the
 * area, that teaches a concept one of the level's items tests. A concept assumed on a
 * lower level is not repeated. Passing a level marks its lessons known, and no more.
 */
export function assumedByLevel(
  area: {
    readonly modules: readonly string[];
    readonly levels: readonly { readonly items: readonly { readonly concept: string }[] }[];
  },
  lessons: readonly PlacementLessonRef[],
): string[][] {
  const inArea = lessons.filter((l) => area.modules.includes(l.moduleId));
  const seen = new Set<string>();
  return area.levels.map((level) => {
    const tested = new Set(level.items.map((i) => i.concept));
    const concepts = inArea
      .filter((l) => l.concepts.some((c) => tested.has(c)))
      .flatMap((l) => l.concepts)
      .filter((c) => area.modules.includes(moduleOfConcept(c)) && !seen.has(c));
    const unique = [...new Set(concepts)];
    unique.forEach((c) => seen.add(c));
    return unique;
  });
}

/** The choices an item is graded on: reasons for a bug-hunt, choices for the rest. */
export function itemChoices(item: PlacementItem) {
  return item.type === 'bug-hunt' ? item.reasons : item.choices;
}

/** The module an item gives evidence for: the part of its concept id before the dot. */
export function moduleOfConcept(concept: string): string {
  return concept.split('.')[0] ?? concept;
}

const issue = (path: string, where: string, rule: string, message: string): Issue => ({
  severity: 'error',
  path,
  where,
  message,
  rule,
});

/**
 * Everything the zod schema cannot see: ids that must be unique across the file, lines
 * that must exist in the code above them, and ids that must match the course.
 */
export function checkPlacement(file: PlacementFile, world: PlacementWorld, path: string): Issue[] {
  const issues: Issue[] = [];
  const knownModules = new Set(world.modules.map((m) => m.id));
  const knownConcepts = new Set(world.modules.flatMap((m) => m.concepts));
  const taught = new Set(world.lessons.flatMap((l) => l.concepts));
  const knownParts = new Set(world.parts);
  const knownPaths = new Set(world.paths);
  const seenItems = new Set<string>();
  const seenAreas = new Set<string>();
  const areaOfModule = new Map<string, string>();

  for (const area of file.areas) {
    const where = `area ${area.id}`;
    if (seenAreas.has(area.id)) {
      issues.push(issue(path, where, 'placement-area-reused', `Two areas are called "${area.id}".`));
    }
    seenAreas.add(area.id);
    if (area.part !== undefined && !knownParts.has(area.part)) {
      issues.push(
        issue(path, where, 'placement-part-unknown', `No course part is called "${area.part}".`),
      );
    }

    for (const moduleId of area.modules) {
      if (!knownModules.has(moduleId)) {
        issues.push(
          issue(
            path,
            where,
            'placement-module-unknown',
            `No module is called "${moduleId}". Use an id from content/course/*/module.yaml.`,
          ),
        );
      }
      const other = areaOfModule.get(moduleId);
      if (other !== undefined) {
        issues.push(
          issue(
            path,
            where,
            'placement-module-twice',
            `"${moduleId}" is in both "${other}" and "${area.id}". A module belongs to one area.`,
          ),
        );
      }
      areaOfModule.set(moduleId, area.id);
    }

    for (const [index, level] of area.levels.entries()) {
      const at = `${where}, level ${level.level}`;
      if (level.level !== index + 1) {
        issues.push(
          issue(path, at, 'placement-level-order', 'Levels are listed in order, 1 to 3, once each.'),
        );
      }
      for (const item of level.items) {
        const itemAt = `${at}, item ${item.id}`;
        if (seenItems.has(item.id)) {
          issues.push(
            issue(path, itemAt, 'placement-item-id-reused', `Two items are called "${item.id}".`),
          );
        }
        seenItems.add(item.id);

        const correct = itemChoices(item).filter((choice) => choice.correct === true).length;
        if (correct !== 1) {
          issues.push(
            issue(
              path,
              itemAt,
              'placement-one-correct',
              `Exactly one choice is correct. This item marks ${correct}.`,
            ),
          );
        }

        if (!knownConcepts.has(item.concept)) {
          issues.push(
            issue(
              path,
              itemAt,
              'placement-concept-unknown',
              `No concept is called "${item.concept}". Use an id from the module it belongs to.`,
            ),
          );
        } else if (!area.modules.includes(moduleOfConcept(item.concept))) {
          issues.push(
            issue(
              path,
              itemAt,
              'placement-concept-off-area',
              `"${item.concept}" belongs to a module outside this area.`,
            ),
          );
        } else if (!taught.has(item.concept)) {
          issues.push(
            issue(
              path,
              itemAt,
              'placement-concept-untaught',
              `No lesson teaches "${item.concept}", so a pass could not mark any lesson known.`,
            ),
          );
        }

        if (item.type === 'bug-hunt') {
          const lines = item.code.split('\n').length;
          for (const line of item.lines) {
            if (line > lines) {
              issues.push(
                issue(
                  path,
                  itemAt,
                  'placement-line-out-of-range',
                  `Line ${line} is at fault, but the code has ${lines} lines.`,
                ),
              );
            }
          }
        }
      }
    }
  }

  for (const [index, rule] of file.paths.entries()) {
    const where = `paths[${index}]`;
    if (!seenAreas.has(rule.area)) {
      issues.push(
        issue(path, where, 'placement-rule-area-unknown', `No area is called "${rule.area}".`),
      );
    }
    if (!knownPaths.has(rule.path)) {
      issues.push(
        issue(
          path,
          where,
          'placement-rule-path-unknown',
          `No path is called "${rule.path}". Use an id from content/tracks/.`,
        ),
      );
    }
  }

  for (const courseModule of world.modules) {
    if (!areaOfModule.has(courseModule.id)) {
      issues.push({
        severity: 'warning',
        path,
        where: 'areas',
        rule: 'placement-module-unplaced',
        message: `No area speaks for "${courseModule.id}", so it starts at the default rating.`,
      });
    }
  }

  return issues;
}
