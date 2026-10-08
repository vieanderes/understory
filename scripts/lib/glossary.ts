import type { Issue, RawCatalog, RawLesson } from '../../src/core/content/catalog';
import { allLessons, allModules } from '../../src/core/content/catalog';
import {
  checkGlossary,
  compiledGlossarySchema,
  DRILL_BUNDLE_FILE,
  GLOSSARY_AREAS,
  GLOSSARY_BUNDLE_FILE,
  namesOf,
  type CompiledDrillWord,
  type CompiledGlossary,
  type CompiledGlossaryWord,
  type RawGlossaryEntry,
} from '../../src/core/content/glossary-schema';
import type { Language } from '../../src/core/content/schema';
import { findMentions, firstMention, type LessonSpots, type Spot } from '../../src/core/vocabulary';
import { loadGlossary } from '../../src/lib/content/fs';
import { stableStringify, type Bundle } from './compile';
import { createRenderer, type Renderer } from './render';

/*
 * The vocabulary, from `content/glossary/` to two bundle files: `glossary.json`, every word
 * in full for the server-rendered pages, and `words.json`, only what a drill needs, which
 * the review fetches and the service worker keeps for offline use. Lesson links are found
 * here, in the lessons themselves, so they cannot go stale (docs/VOCABULARY.md).
 */

/** Prose a learner reads in a step: never code, ids or answers' internals. */
const PROSE_KEYS = new Set(['body', 'question', 'prompt', 'text', 'feedback', 'explanation']);

function proseIn(value: unknown, key = ''): string[] {
  if (typeof value === 'string') return PROSE_KEYS.has(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => proseIn(item, key));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => proseIn(v, k));
  }
  return [];
}

const plain = (md: string): string => md.replace(/[`*_]/g, '');

/** Every place in one lesson a word could be met, strongest first: see mentions.ts. */
function spotsOf(lesson: RawLesson): Spot[] {
  const id = lesson.data.id;
  const notes = lesson.notes?.data;
  const spots: Spot[] = [];
  if (notes?.terms) {
    spots.push({
      anchor: `${id}-terms`,
      label: 'Terms',
      text: notes.terms.map((t) => t.term).join('\n'),
      strength: 4,
    });
  }
  // A section named after the word is about it; one that mentions it in passing is not.
  notes?.sections.forEach((section, i) => {
    const at = { anchor: `${id}-deeper-${i}`, label: plain(section.title) };
    spots.push(
      { ...at, text: section.title, strength: 3.5 },
      { ...at, text: section.body, strength: 2 },
    );
  });
  if (notes) {
    spots.push({
      anchor: `${id}-picture`,
      label: 'The big picture',
      text: [notes.summary, ...notes.remember].join('\n'),
      strength: 3,
    });
  }
  spots.push({
    anchor: `${id}-lesson`,
    label: 'The lesson, step by step',
    text: [lesson.data.opening, ...proseIn(lesson.data.steps)].join('\n'),
    strength: 1,
  });
  return spots;
}

const GAP = 'GLOSSARYGAP';

/** The usage sentence with its first mention of the word replaced by a blank. */
function gapHtml(entry: RawGlossaryEntry, render: Renderer): string {
  const { usage } = entry.data;
  const found = firstMention(usage, namesOf(entry.data));
  // The checker guarantees a mention; without one the drill still reads as a sentence.
  const withGap = found
    ? `${usage.slice(0, found.index)}${GAP}${usage.slice(found.index + found.length)}`
    : usage;
  return render
    .inline(withGap)
    .replace(GAP, '<span class="word-gap" aria-label="blank">_____</span>');
}

export function compileGlossary(
  entries: readonly RawGlossaryEntry[],
  catalog: RawCatalog,
  render: Renderer,
): CompiledGlossary {
  const lessonSpots: LessonSpots[] = allLessons(catalog).map(({ lesson }) => ({
    lessonId: lesson.data.id,
    spots: spotsOf(lesson),
  }));
  const lessonInfo = new Map(
    allModules(catalog).flatMap((courseModule) =>
      courseModule.lessons.map((lesson) => [
        lesson.data.id,
        {
          title: lesson.data.title,
          chapter: courseModule.data.title,
          lecture: `/lectures/${courseModule.slug}/${lesson.slug}`,
          learn: `/learn/${courseModule.slug}/${lesson.slug}`,
        },
      ]),
    ),
  );
  const order = new Map<string, number>(GLOSSARY_AREAS.map((a, i) => [a.id, i]));
  const sorted = [...entries].sort(
    (a, b) =>
      (order.get(a.area) ?? 99) - (order.get(b.area) ?? 99) ||
      a.data.term.localeCompare(b.data.term, 'en', { sensitivity: 'base' }),
  );

  const words: CompiledGlossaryWord[] = sorted.map((entry) => {
    const { data } = entry;
    const seenIn = findMentions(namesOf(data), lessonSpots, data.lessons ?? []).flatMap(
      (mention) => {
        const info = lessonInfo.get(mention.lessonId);
        if (!info) return [];
        return [
          {
            lessonId: mention.lessonId,
            title: info.title,
            chapter: info.chapter,
            href: `${info.lecture}#${mention.anchor ?? `${mention.lessonId}-title`}`,
            spot: mention.label,
            learnHref: info.learn,
          },
        ];
      },
    );
    return {
      id: entry.id,
      term: data.term,
      aka: data.aka ?? [],
      area: entry.area,
      level: data.level,
      short: plain(data.short),
      shortHtml: render.inline(data.short),
      analogyHtml: render.inline(data.analogy),
      gapHtml: gapHtml(entry, render),
      ...(data.example
        ? {
            exampleHtml: render.code(data.example.code, data.example.language),
            exampleLanguage: data.example.language,
          }
        : {}),
      ...(data.twin
        ? { twin: data.twin.term, twinDifferenceHtml: render.inline(data.twin.difference) }
        : {}),
      related: data.related ?? [],
      explainHtml: render.markdown(data.explain),
      usageHtml: render.inline(data.usage),
      seenIn,
    };
  });

  const counts = new Map<string, number>();
  for (const word of words) counts.set(word.area, (counts.get(word.area) ?? 0) + 1);
  return compiledGlossarySchema.parse({
    areas: GLOSSARY_AREAS.map((area) => ({ ...area, words: counts.get(area.id) ?? 0 })),
    words,
  });
}

/** Only what the drills read, so the review downloads a fraction of the glossary. */
export function drillWordsOf(glossary: CompiledGlossary): CompiledDrillWord[] {
  return glossary.words.map((word) => ({
    id: word.id,
    term: word.term,
    aka: word.aka,
    area: word.area,
    level: word.level,
    short: word.short,
    shortHtml: word.shortHtml,
    analogyHtml: word.analogyHtml,
    gapHtml: word.gapHtml,
    ...(word.exampleHtml === undefined ? {} : { exampleHtml: word.exampleHtml }),
    ...(word.twin === undefined ? {} : { twin: word.twin }),
    related: word.related,
  }));
}

/** Adds `glossary.json` and `words.json` to the bundle. Errors stop the build. */
export async function addGlossary(
  bundle: Bundle,
  catalog: RawCatalog,
  root?: string,
): Promise<number> {
  const { entries, issues } = loadGlossary(root);
  const lessonIds = new Set(allLessons(catalog).map(({ lesson }) => lesson.data.id));
  const errors: Issue[] = [...issues, ...checkGlossary(entries, { lessonIds })].filter(
    (issue) => issue.severity === 'error',
  );
  if (errors.length > 0) {
    throw new Error(
      `content/glossary is not valid, so the bundle was not written:\n  ${errors
        .map((error) => `${error.path}: ${error.message}`)
        .join('\n  ')}`,
    );
  }
  const languages = [
    ...new Set(entries.flatMap((e) => (e.data.example ? [e.data.example.language] : []))),
  ] as Language[];
  const render = await createRenderer(languages);
  const glossary = compileGlossary(entries, catalog, render);
  bundle.files.set(GLOSSARY_BUNDLE_FILE, stableStringify(glossary));
  bundle.files.set(DRILL_BUNDLE_FILE, stableStringify({ words: drillWordsOf(glossary) }));
  return glossary.words.length;
}
