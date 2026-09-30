import { z } from 'zod';
import { idSchema } from './schema';

/*
 * The outline is the plan of the course: every lesson that will exist, with the id and the
 * folder it will be published under. It is written before the lessons, so many authors can
 * work at once without two of them inventing the same id or folder. `outline.yaml` sits
 * next to `course.yaml`. The rules that tie it to the published content are in validate.ts.
 */

const text = (hint: string) => z.string().trim().min(1, hint).describe(hint);

const numberedDir = (example: string) =>
  z
    .string()
    .regex(
      /^\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/,
      `A folder name is a two-digit number, a hyphen and lowercase words, for example "${example}".`,
    );

const labId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'A lab id is lowercase words joined by hyphens.');

export const OUTLINE_CONCEPTS_MIN = 2;
export const OUTLINE_CONCEPTS_MAX = 4;

export const outlineLessonSchema = z.strictObject({
  id: idSchema,
  dir: numberedDir('02-scope-and-closures').describe('The lesson folder inside the module folder.'),
  title: text('The lesson title, as in docs/CURRICULUM.md.'),
  objective: text('What the learner can do afterwards, starting with a verb.'),
  level: z.enum(['essential', 'advanced']),
  concepts: z
    .array(idSchema)
    .min(OUTLINE_CONCEPTS_MIN)
    .max(OUTLINE_CONCEPTS_MAX)
    .describe('Concepts this lesson teaches, defined in the module.yaml of its own module.'),
  lab: labId.optional().describe('Set when this lesson hosts a lab, for example "event-loop-stepper".'),
  wovenAfter: idSchema
    .optional()
    .describe('For a woven module: the id of the lesson this one follows in the journey.'),
});

export const outlineModuleSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9]*$/, 'A module id is one lowercase word, for example "js".'),
  dir: numberedDir('03-javascript').describe('The module folder inside content/course.'),
  lessons: z.array(outlineLessonSchema).min(1),
});

export const outlineSchema = z.strictObject({
  modules: z.array(outlineModuleSchema).min(1),
});

export type OutlineLesson = z.infer<typeof outlineLessonSchema>;
export type OutlineModule = z.infer<typeof outlineModuleSchema>;
export type Outline = z.infer<typeof outlineSchema>;

/** The parsed, schema-valid outline with where it came from. */
export interface RawOutline {
  /** Repo-relative path of `outline.yaml`. */
  path: string;
  data: Outline;
}

export const OUTLINE_PATH = 'content/course/outline.yaml';

/** `03-javascript` gives `javascript`: the URL segment, as in RawModule.slug. */
export const slugOfDir = (dir: string): string => dir.replace(/^\d{2}-/, '');

/** `03-javascript` gives 3. */
export const orderOfDir = (dir: string): number => Number(dir.slice(0, 2));

export interface OutlineEntry {
  module: OutlineModule;
  lesson: OutlineLesson;
}

/** Every planned lesson with its module, in file order. */
export function outlineEntries(outline: Outline): OutlineEntry[] {
  return outline.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
}

/**
 * Journey order: a woven lesson moves to just after the lesson named by `wovenAfter`.
 * Several lessons woven after the same one keep their file order. A lesson whose target is
 * missing stays where the file has it, and the validator reports it.
 */
export function journeyOrder(outline: Outline): OutlineEntry[] {
  const entries = outlineEntries(outline);
  const ids = new Set(entries.map(({ lesson }) => lesson.id));
  const isWoven = ({ lesson }: OutlineEntry): boolean =>
    lesson.wovenAfter !== undefined && lesson.wovenAfter !== lesson.id && ids.has(lesson.wovenAfter);
  const followers = new Map<string, OutlineEntry[]>();
  for (const entry of entries.filter(isWoven)) {
    const target = entry.lesson.wovenAfter ?? '';
    followers.set(target, [...(followers.get(target) ?? []), entry]);
  }
  const placed = new Set<string>();
  const place = (entry: OutlineEntry): OutlineEntry[] => {
    if (placed.has(entry.lesson.id)) return [];
    placed.add(entry.lesson.id);
    return [entry, ...(followers.get(entry.lesson.id) ?? []).flatMap(place)];
  };
  const ordered = entries.filter((entry) => !isWoven(entry)).flatMap(place);
  // A cycle of wovenAfter links is reachable from no unwoven lesson. Keep those at the end.
  return [...ordered, ...entries.filter((entry) => !placed.has(entry.lesson.id))];
}
