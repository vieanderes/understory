import * as z from '@/core/zod';
import type { Issue } from './catalog';
import type {
  CompiledBugHuntStep,
  CompiledMultipleChoiceStep,
  CompiledPredictStep,
} from './compiled';
import { bugHuntStepSchema, multipleChoiceStepSchema, predictStepSchema } from './schema';

/*
 * Placement (docs/LEARNING-SCIENCE.md B1). The course is measured module by module: a part
 * holds lessons with very different focuses, and someone can know half of a part and not
 * the other half. Every learner meets the same fixed questions, so two results mean the
 * same thing.
 *
 * Each module has two core questions and two deep ones, each from a different lesson. The
 * first core question is asked in every mode, the second only in the thorough one. A deep
 * question follows a shown core answer; the second deep one confirms the first unless it
 * was answered with certainty, so "strong" never rests on one lucky pick.
 *
 * What a right answer lets the course assume is not written by hand: it is the concepts of
 * the lessons that teach what the question tests (`assumedByItem`).
 *
 * An item is an ordinary lesson step, so the player, the graders and the compiler are the
 * ones lessons already use. Only the three formats that read in under 45 seconds are
 * allowed: predict-output, multiple-choice and bug-hunt.
 */

export const PLACEMENT_SCHEMA = 3;
export const CORE_ITEMS = 2;
export const DEEP_ITEMS = 2;
export const QUICK_MODULES = 2;

/** Matches `moduleSchema.id` in schema.ts: one lowercase word, for example "js". */
const placementModuleId = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, 'A module id is one lowercase word, for example "js".');

/** Same rule as a module id, so an area can share its id with the course part it mirrors. */
const placementAreaId = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, 'An area id is one lowercase word, for example "servers".');

/** A question that needs two ideas at once names the second in `also`. */
const also = {
  also: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe('Further concepts a right answer shows, from modules of the same part.'),
};

export const placementItemSchema = z.discriminatedUnion('type', [
  predictStepSchema.extend(also),
  multipleChoiceStepSchema.extend(also),
  // A placement item is answered in one tap of a line and one reason: no verify follow-up.
  bugHuntStepSchema.omit({ verify: true }).extend(also),
]);

export const placementModuleSchema = z.strictObject({
  id: placementModuleId,
  core: z
    .array(placementItemSchema)
    .length(CORE_ITEMS, `A module has exactly ${CORE_ITEMS} core questions.`)
    .describe('What anyone who has worked through the module gets right.'),
  deep: z
    .array(placementItemSchema)
    .length(DEEP_ITEMS, `A module has exactly ${DEEP_ITEMS} deep questions.`)
    .describe('Harder follow-ups, asked after a right core answer.'),
});

export const placementAreaSchema = z.strictObject({
  id: placementAreaId,
  title: z.string().min(1).describe('As the results screen names it, for example "Servers and data".'),
  /** The course part this area mirrors, so a strong result can offer its test-out. */
  part: placementAreaId.optional(),
  quick: z
    .array(placementModuleId)
    .length(QUICK_MODULES, `The quick check asks ${QUICK_MODULES} modules of each area.`)
    .describe('The modules that best stand for the area, asked in the quick check.'),
  modules: z.array(placementModuleSchema).min(1).describe('In course order.'),
});

/**
 * Which written path fits a learner whose weakest area is `area`, while that area is below
 * `below`. The first rule that fits wins. An area with no rule gets a path built from its
 * own lessons.
 */
export const placementPathRuleSchema = z.strictObject({
  area: placementAreaId,
  below: z.int().min(1).max(3),
  path: z.string().regex(/^[a-z0-9-]+$/, 'A path id, as in content/tracks/<id>.yaml.'),
});

export const placementFileSchema = z.strictObject({
  schema: z.literal(PLACEMENT_SCHEMA),
  areas: z.array(placementAreaSchema).min(1),
  paths: z.array(placementPathRuleSchema),
});

export type PlacementItem = z.infer<typeof placementItemSchema>;
export type PlacementModule = z.infer<typeof placementModuleSchema>;
export type PlacementArea = z.infer<typeof placementAreaSchema>;
export type PlacementPathRule = z.infer<typeof placementPathRuleSchema>;
export type PlacementFile = z.infer<typeof placementFileSchema>;

// ---------------------------------------------------------------------------
// The compiled shapes, in the bundle at `placement.json`
// ---------------------------------------------------------------------------

export type CompiledPlacementItem = (
  | CompiledPredictStep
  | CompiledMultipleChoiceStep
  | Omit<CompiledBugHuntStep, 'verify'>
) & { also?: string[] };

export interface CompiledPlacementModule {
  id: string;
  core: CompiledPlacementItem[];
  deep: CompiledPlacementItem[];
  /** Derived at build time by `assumedByItem`: what a right answer to each item assumes. */
  assumes: Record<string, string[]>;
}

export interface CompiledPlacementArea {
  id: string;
  title: string;
  part?: string;
  quick: string[];
  modules: CompiledPlacementModule[];
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

/** The concepts an item tests: its own, and any it names in `also`. */
export function testedConcepts(item: {
  readonly concept: string;
  readonly also?: readonly string[] | undefined;
}): string[] {
  return [item.concept, ...(item.also ?? [])];
}

/**
 * What a right answer to an item lets the course assume: the concepts of every lesson in
 * the area that teaches one of the concepts the item tests, kept to the area's modules.
 * One answer marks the lessons it tested known, and no more.
 */
export function assumedByItem(
  item: { readonly concept: string; readonly also?: readonly string[] | undefined },
  areaModules: readonly string[],
  lessons: readonly PlacementLessonRef[],
): string[] {
  const tested = new Set(testedConcepts(item));
  const concepts = lessons
    .filter((l) => areaModules.includes(l.moduleId) && l.concepts.some((c) => tested.has(c)))
    .flatMap((l) => l.concepts)
    .filter((c) => areaModules.includes(moduleOfConcept(c)));
  return [...new Set(concepts)];
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
    const areaModules = area.modules.map((m) => m.id);
    if (seenAreas.has(area.id)) {
      issues.push(issue(path, where, 'placement-area-reused', `Two areas are called "${area.id}".`));
    }
    seenAreas.add(area.id);
    if (area.part !== undefined && !knownParts.has(area.part)) {
      issues.push(
        issue(path, where, 'placement-part-unknown', `No course part is called "${area.part}".`),
      );
    }
    for (const quick of area.quick) {
      if (!areaModules.includes(quick)) {
        issues.push(
          issue(
            path,
            where,
            'placement-quick-unknown',
            `The quick check names "${quick}", which is not a module of this area.`,
          ),
        );
      }
    }
    if (new Set(area.quick).size !== area.quick.length) {
      issues.push(
        issue(path, where, 'placement-quick-twice', 'The quick check names a module twice.'),
      );
    }

    for (const courseModule of area.modules) {
      const moduleId = courseModule.id;
      const at = `${where}, module ${moduleId}`;
      if (!knownModules.has(moduleId)) {
        issues.push(
          issue(
            path,
            at,
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
            at,
            'placement-module-twice',
            `"${moduleId}" is in both "${other}" and "${area.id}". A module belongs to one area.`,
          ),
        );
      }
      areaOfModule.set(moduleId, area.id);

      for (const item of [...courseModule.core, ...courseModule.deep]) {
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

        for (const concept of testedConcepts(item)) {
          const isOwn = concept === item.concept;
          if (!knownConcepts.has(concept)) {
            issues.push(
              issue(
                path,
                itemAt,
                'placement-concept-unknown',
                `No concept is called "${concept}". Use an id from the module it belongs to.`,
              ),
            );
          } else if (isOwn && moduleOfConcept(concept) !== moduleId) {
            issues.push(
              issue(
                path,
                itemAt,
                'placement-concept-off-module',
                `"${concept}" belongs to another module than "${moduleId}".`,
              ),
            );
          } else if (!isOwn && !areaModules.includes(moduleOfConcept(concept))) {
            issues.push(
              issue(
                path,
                itemAt,
                'placement-concept-off-area',
                `"${concept}" belongs to a module outside this area.`,
              ),
            );
          } else if (!taught.has(concept)) {
            issues.push(
              issue(
                path,
                itemAt,
                'placement-concept-untaught',
                `No lesson teaches "${concept}", so a right answer could not mark any lesson known.`,
              ),
            );
          }
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
        message: `No area asks about "${courseModule.id}", so placement never measures it.`,
      });
    }
  }

  return issues;
}
