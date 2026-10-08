/**
 * What a lesson could add to the vocabulary: `pnpm glossary:gaps <lessonId>...`. With no
 * ids, every lesson no word pins yet. Prints the words it already says, to pin, and the key
 * terms no word covers, to write (docs/VOCABULARY.md, "Growing with the course").
 */
import { allLessons } from '../src/core/content/catalog';
import { namesOf } from '../src/core/content/glossary-schema';
import { wordGaps } from '../src/core/vocabulary';
import { loadGlossary, loadRawCatalog } from '../src/lib/content/fs';
import { proseIn } from './lib/glossary';

const PIN_SHOWN = 6;

const { catalog } = loadRawCatalog();
const { entries } = loadGlossary();
const words = entries.map((e) => ({ id: e.id, names: namesOf(e.data), path: e.path }));
const pinned = new Set(entries.flatMap((e) => e.data.lessons ?? []));
const lessons = allLessons(catalog).map(({ lesson }) => lesson);
const wanted = process.argv.slice(2);
const chosen =
  wanted.length > 0
    ? lessons.filter((l) => wanted.includes(l.data.id))
    : lessons.filter((l) => !pinned.has(l.data.id));

for (const id of wanted.filter((id) => !lessons.some((l) => l.data.id === id))) {
  console.log(`${id}: no lesson has this id.`);
}
for (const lesson of chosen) {
  const notes = lesson.notes?.data;
  const texts = [
    ...Object.values(lesson.data.opening).filter((v): v is string => typeof v === 'string'),
    ...proseIn(lesson.data.steps),
    ...(notes
      ? [notes.summary, ...notes.remember, ...notes.sections.flatMap((s) => [s.title, s.body])]
      : []),
  ];
  const gaps = wordGaps(texts, notes?.terms?.map((t) => t.term) ?? [], words);
  console.log(
    `\n${lesson.data.id}: ${lesson.data.title}${pinned.has(lesson.data.id) ? '' : '  (no word pins it yet)'}`,
  );
  console.log(`  Pin it on: ${gaps.toPin.slice(0, PIN_SHOWN).join(', ') || 'nothing yet'}`);
  console.log(`  Not in the vocabulary: ${gaps.missing.join('; ') || 'nothing'}`);
}
console.log(`\n${chosen.length} lessons.`);
