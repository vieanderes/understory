import * as z from '@/core/zod';
import { termIdSchema } from '@/core/vocabulary/ids';
import { says } from '@/core/vocabulary/match';
import type { Issue } from './catalog';
import { idSchema } from './ids';
import { languageSchema } from './schema';
import {
  bannedWordsIn,
  EM_DASH,
  fencesOf,
  sentencesOf,
  withdrawnSettingTermsIn,
  wordCount,
} from './style';

/*
 * The vocabulary: every term the course teaches, one file each at
 * `content/glossary/<area>/<id>.yaml`. The file name is the id and the folder is the area,
 * so neither can disagree with the path. Lesson links are not written by hand: the build
 * finds them in the lessons and notes (src/core/vocabulary/mentions.ts), so they never go
 * stale. An author may pin the lesson that teaches the word first with `lessons`.
 */

export const GLOSSARY_DIR = 'content/glossary';
export const GLOSSARY_BUNDLE_FILE = 'glossary.json';

/** The areas, in the order the filter shows them. */
export const GLOSSARY_AREAS = [
  { id: 'web', title: 'The web' },
  { id: 'javascript', title: 'JavaScript' },
  { id: 'typescript', title: 'TypeScript' },
  { id: 'react', title: 'React and the front end' },
  { id: 'css', title: 'CSS' },
  { id: 'python', title: 'Python' },
  { id: 'sql', title: 'Databases and SQL' },
  { id: 'testing', title: 'Testing' },
  { id: 'security', title: 'Security' },
  { id: 'system-design', title: 'System design' },
  { id: 'patterns', title: 'Patterns and architecture' },
  { id: 'ai', title: 'AI engineering' },
  { id: 'tooling', title: 'Tooling and delivery' },
  { id: 'career', title: 'Career and teamwork' },
] as const;

export type GlossaryAreaId = (typeof GLOSSARY_AREAS)[number]['id'];

const AREA_IDS: ReadonlySet<string> = new Set(GLOSSARY_AREAS.map((a) => a.id));

export const isGlossaryArea = (id: string): id is GlossaryAreaId => AREA_IDS.has(id);

export { termIdSchema };

const text = (hint: string) => z.string().trim().min(1, hint).describe(hint);

/** The longest short meaning, in words. A drill shows four of them side by side. */
export const SHORT_MAX_WORDS = 18;
export const EXAMPLE_MAX_LINES = 12;

export const glossaryEntrySchema = z.strictObject({
  term: text('The word as people write it: "closure", "N+1 query", "idempotent".'),
  aka: z
    .array(text('Another name, a nickname or an abbreviation.'))
    .max(6)
    .optional()
    .describe('Other names people search by. A plural is found without listing it.'),
  short: text(
    'One plain sentence a fifteen-year-old follows, without the word itself. Drills show it as the meaning.',
  ),
  explain: text('The real explanation in two to four short paragraphs of markdown.'),
  analogy: text('An everyday picture of the idea, in one or two sentences.'),
  example: z
    .strictObject({
      language: languageSchema,
      code: text('A few lines that show the word at work.'),
    })
    .optional()
    .describe('Code where code helps. The snippet drill asks which word it shows.'),
  usage: text(
    'One sentence as a colleague says it in a review or a meeting. It contains the word.',
  ),
  twin: z
    .strictObject({
      term: termIdSchema.describe('The id of the word it is always confused with.'),
      difference: text('How to tell them apart, in one or two sentences.'),
    })
    .optional()
    .describe('The evil twin: the word people mix up with this one.'),
  related: z.array(termIdSchema).max(8).optional().describe('Ids of words worth reading next.'),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .describe('1: everyone says it. 2: working vocabulary. 3: a deeper cut.'),
  lessons: z
    .array(idSchema)
    .max(4)
    .optional()
    .describe('Lesson ids that teach the word, pinned first. The rest are found by the build.'),
});

export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

/** One read file: its id and area come from the path. */
export interface RawGlossaryEntry {
  id: string;
  area: string;
  path: string;
  data: GlossaryEntry;
}

export interface GlossaryWorld {
  lessonIds: ReadonlySet<string>;
}

/** The names a word is found by: its term and its aliases. */
export const namesOf = (entry: GlossaryEntry): string[] => [entry.term, ...(entry.aka ?? [])];

const normalName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, ' ')
    .trim();

/** Every rule a glossary file must pass. Pure: the reader hands in what it found. */
export function checkGlossary(entries: readonly RawGlossaryEntry[], world: GlossaryWorld): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set(entries.map((e) => e.id));
  const owner = new Map<string, string>();

  const add = (entry: RawGlossaryEntry, rule: string, message: string, where?: string) =>
    issues.push({
      severity: 'error',
      path: entry.path,
      rule,
      message,
      ...(where === undefined ? {} : { where }),
    });

  const seenIds = new Map<string, string>();
  for (const entry of entries) {
    const { data } = entry;
    const other = seenIds.get(entry.id);
    if (other !== undefined) {
      add(
        entry,
        'glossary-id-duplicate',
        `"${entry.id}" is also a word in ${other}. An id names one word across every area.`,
      );
    } else seenIds.set(entry.id, entry.area);
    if (!termIdSchema.safeParse(entry.id).success) {
      add(entry, 'glossary-id', `Name the file in lowercase words joined by hyphens, not "${entry.id}".`);
    }
    if (!isGlossaryArea(entry.area)) {
      add(
        entry,
        'glossary-area-unknown',
        `"${entry.area}" is not an area. Use one of: ${GLOSSARY_AREAS.map((a) => a.id).join(', ')}.`,
      );
    }

    for (const name of new Set(namesOf(data).map(normalName))) {
      const first = owner.get(name);
      if (first !== undefined && first !== entry.id) {
        add(
          entry,
          'glossary-duplicate',
          `"${name}" is already a word or an alias of "${first}". Merge them, or name the difference.`,
        );
      } else owner.set(name, entry.id);
    }

    for (const related of data.related ?? []) {
      if (related === entry.id) add(entry, 'glossary-related-self', 'A word is not related to itself.', 'related');
      else if (!ids.has(related)) {
        add(entry, 'glossary-related-unknown', `No word has the id "${related}".`, 'related');
      }
    }
    if (data.twin) {
      if (data.twin.term === entry.id) {
        add(entry, 'glossary-twin-self', 'A word is not its own twin.', 'twin');
      } else if (!ids.has(data.twin.term)) {
        add(entry, 'glossary-twin-unknown', `No word has the id "${data.twin.term}".`, 'twin');
      }
    }
    for (const lesson of data.lessons ?? []) {
      if (!world.lessonIds.has(lesson)) {
        add(entry, 'glossary-lesson-unknown', `No lesson has the id "${lesson}".`, 'lessons');
      }
    }

    if (!says(data.usage, namesOf(data))) {
      add(
        entry,
        'glossary-usage-term',
        `The usage sentence never says "${data.term}". The gap drill hides the word, so it has to be there.`,
        'usage',
      );
    }
    if (sentencesOf(data.short).length > 1) {
      add(entry, 'glossary-short-sentence', 'Keep the short meaning to one sentence.', 'short');
    }
    if (wordCount(data.short) > SHORT_MAX_WORDS) {
      add(
        entry,
        'glossary-short-long',
        `The short meaning has ${wordCount(data.short)} words. Keep it to ${SHORT_MAX_WORDS}: four of them share a screen.`,
        'short',
      );
    }
    if (says(data.short, namesOf(data))) {
      add(
        entry,
        'glossary-short-names-term',
        'The short meaning says the word itself, so a drill would give the answer away.',
        'short',
      );
    }

    const prose: [string, string][] = [
      ['short', data.short],
      ['explain', data.explain],
      ['analogy', data.analogy],
      ['usage', data.usage],
      ...(data.twin ? ([['twin', data.twin.difference]] as [string, string][]) : []),
    ];
    for (const [where, value] of prose) {
      for (const word of bannedWordsIn(value)) {
        add(entry, 'glossary-banned-word', `Cut "${word}" (docs/CONTENT-GUIDE.md, style).`, where);
      }
      if (value.includes(EM_DASH)) {
        add(entry, 'glossary-em-dash', 'Use a comma, a colon or a full stop, not an em-dash.', where);
      }
    }
    const everything = [...prose.map(([, v]) => v), data.example?.code ?? '', data.term].join('\n');
    const withdrawn = withdrawnSettingTermsIn(everything);
    if (withdrawn.length > 0) {
      add(
        entry,
        'glossary-withdrawn-setting',
        `Examples are generic. Replace "${withdrawn.join('", "')}" (docs/AUTHOR-BRIEF.md, "Examples").`,
      );
    }
    const lines = data.example?.code.trim().split('\n').length ?? 0;
    const fenceLines = fencesOf(data.explain).reduce((sum, f) => sum + f.lines, 0);
    if (lines > EXAMPLE_MAX_LINES || fenceLines > EXAMPLE_MAX_LINES) {
      add(
        entry,
        'glossary-example-long',
        `Keep code to ${EXAMPLE_MAX_LINES} lines. A word's example shows one thing.`,
        'example',
      );
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// The compiled shapes. Markdown and code are rendered at build time, as in lessons.
// ---------------------------------------------------------------------------

/** Where the course uses a word: a lesson, and the spot in its lecture. */
export const compiledSeenInSchema = z.strictObject({
  lessonId: idSchema,
  title: z.string(),
  chapter: z.string(),
  /** The lecture, at the spot, or the lecture's top when the word is pinned but never said. */
  href: z.string(),
  /** "Terms", a section's title, "The lesson, step by step". */
  spot: z.string().nullable(),
  /** The lesson itself, to practise. */
  learnHref: z.string(),
});

/** What a drill needs of a word, and nothing more: `words.json`, fetched by the review. */
export const compiledDrillWordSchema = z.strictObject({
  id: termIdSchema,
  term: z.string(),
  aka: z.array(z.string()),
  area: z.string(),
  level: z.int().min(1).max(3),
  /** Plain text, for search and the speed round. */
  short: z.string(),
  shortHtml: z.string(),
  analogyHtml: z.string(),
  /** The usage sentence with the word cut out: the gap drill. */
  gapHtml: z.string(),
  exampleHtml: z.string().optional(),
  twin: termIdSchema.optional(),
  related: z.array(termIdSchema),
});

export const compiledGlossaryWordSchema = compiledDrillWordSchema.extend({
  explainHtml: z.string(),
  usageHtml: z.string(),
  exampleLanguage: languageSchema.optional(),
  twinDifferenceHtml: z.string().optional(),
  seenIn: z.array(compiledSeenInSchema),
});

export const compiledGlossarySchema = z.strictObject({
  areas: z.array(z.strictObject({ id: z.string(), title: z.string(), words: z.int().min(0) })),
  words: z.array(compiledGlossaryWordSchema),
});

export const compiledDrillFileSchema = z.strictObject({
  words: z.array(compiledDrillWordSchema),
});

export type CompiledSeenIn = z.infer<typeof compiledSeenInSchema>;
export type CompiledDrillWord = z.infer<typeof compiledDrillWordSchema>;
export type CompiledGlossaryWord = z.infer<typeof compiledGlossaryWordSchema>;
export type CompiledGlossary = z.infer<typeof compiledGlossarySchema>;
export type CompiledDrillFile = z.infer<typeof compiledDrillFileSchema>;

export const DRILL_BUNDLE_FILE = 'words.json';
