import { z } from 'zod';
import type { Issue } from './catalog';
import type {
  CompiledBugHuntStep,
  CompiledMultipleChoiceStep,
  CompiledPredictStep,
} from './compiled';
import { bugHuntStepSchema, idSchema, multipleChoiceStepSchema, predictStepSchema } from './schema';

/*
 * The first-session placement ladder (docs/LEARNING-SCIENCE.md B1): ten rungs, each
 * speaking for a band of modules, each holding three alternative items so a learner who
 * takes the ladder twice does not meet the same snippet.
 *
 * An item is an ordinary lesson step, so the player, the graders and the compiler are the
 * ones lessons already use. Only the three formats that read in under 45 seconds are
 * allowed: predict-output, multiple-choice and bug-hunt.
 */

export const PLACEMENT_SCHEMA = 1;
export const PLACEMENT_RUNGS = 10;
export const ITEMS_PER_RUNG = 3;

/** Matches `moduleSchema.id` in schema.ts: one lowercase word, for example "js". */
const placementModuleId = z
  .string()
  .regex(/^[a-z][a-z0-9]*$/, 'A module id is one lowercase word, for example "js".');

export const placementItemSchema = z.discriminatedUnion('type', [
  predictStepSchema,
  multipleChoiceStepSchema,
  // A placement item is answered in one tap of a line and one reason: no verify follow-up.
  bugHuntStepSchema.omit({ verify: true }),
]);

export const placementRungSchema = z.strictObject({
  rung: z.int().min(1).max(PLACEMENT_RUNGS).describe('Which rung this is, 1 at the bottom.'),
  moduleBand: z
    .array(placementModuleId)
    .min(1)
    .describe('The modules this rung speaks for. A pass sets their starting theta.'),
  concepts: z
    .array(idSchema)
    .min(1)
    .describe('What a correct answer lets the course assume, once the ladder has moved past.'),
  items: z
    .array(placementItemSchema)
    .length(ITEMS_PER_RUNG, `A rung holds ${ITEMS_PER_RUNG} alternative items, one per visit.`),
});

export const placementFileSchema = z.strictObject({
  schema: z.literal(PLACEMENT_SCHEMA),
  rungs: z
    .array(placementRungSchema)
    .length(PLACEMENT_RUNGS, `The ladder has exactly ${PLACEMENT_RUNGS} rungs.`),
});

export type PlacementItem = z.infer<typeof placementItemSchema>;
export type PlacementRung = z.infer<typeof placementRungSchema>;
export type PlacementFile = z.infer<typeof placementFileSchema>;

// ---------------------------------------------------------------------------
// The compiled shapes, in the bundle at `placement.json`
// ---------------------------------------------------------------------------

export type CompiledPlacementItem =
  | CompiledPredictStep
  | CompiledMultipleChoiceStep
  | Omit<CompiledBugHuntStep, 'verify'>;

export interface CompiledPlacementRung {
  rung: number;
  moduleBand: string[];
  concepts: string[];
  items: CompiledPlacementItem[];
}

export interface CompiledPlacementFile {
  schema: typeof PLACEMENT_SCHEMA;
  rungs: CompiledPlacementRung[];
}

// ---------------------------------------------------------------------------
// Checks that need the rest of the content
// ---------------------------------------------------------------------------

/** The modules of the course, in course order, with the concept ids each one owns. */
export interface PlacementWorld {
  readonly modules: readonly { readonly id: string; readonly concepts: readonly string[] }[];
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
  const seenIds = new Set<string>();
  const banded = new Set<string>();

  for (const [index, rung] of file.rungs.entries()) {
    const where = `rung ${rung.rung}`;
    if (rung.rung !== index + 1) {
      issues.push(
        issue(path, where, 'placement-rung-order', 'Rungs are listed in order, 1 to 10, once each.'),
      );
    }
    for (const moduleId of rung.moduleBand) {
      banded.add(moduleId);
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
    }
    for (const concept of rung.concepts) {
      if (!knownConcepts.has(concept)) {
        issues.push(
          issue(
            path,
            where,
            'placement-concept-unknown',
            `No concept is called "${concept}". Use an id from the module it belongs to.`,
          ),
        );
      }
    }

    for (const item of rung.items) {
      const at = `${where}, item ${item.id}`;
      if (seenIds.has(item.id)) {
        issues.push(
          issue(path, at, 'placement-item-id-reused', `Two items are called "${item.id}".`),
        );
      }
      seenIds.add(item.id);

      const correct = itemChoices(item).filter((choice) => choice.correct === true).length;
      if (correct !== 1) {
        issues.push(
          issue(
            path,
            at,
            'placement-one-correct',
            `Exactly one choice is correct. This item marks ${correct}.`,
          ),
        );
      }

      if (!rung.concepts.includes(item.concept)) {
        issues.push(
          issue(
            path,
            at,
            'placement-concept-off-rung',
            `The item's concept "${item.concept}" is not one this rung lists.`,
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
                at,
                'placement-line-out-of-range',
                `Line ${line} is at fault, but the code has ${lines} lines.`,
              ),
            );
          }
        }
      }
    }
  }

  for (const courseModule of world.modules) {
    if (!banded.has(courseModule.id)) {
      issues.push({
        severity: 'warning',
        path,
        where: 'moduleBand',
        rule: 'placement-module-unbanded',
        message: `No rung speaks for "${courseModule.id}", so it starts at the default rating.`,
      });
    }
  }

  return issues;
}
