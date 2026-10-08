/**
 * Checks only the vocabulary, in a second: `pnpm glossary:check`. The full validator runs
 * the same rules with everything else.
 */
import { checkGlossary } from '../src/core/content/glossary-schema';
import { allLessons } from '../src/core/content/catalog';
import { loadGlossary, loadRawCatalog } from '../src/lib/content/fs';

const { catalog } = loadRawCatalog();
const glossary = loadGlossary();
const lessonIds = new Set(allLessons(catalog).map(({ lesson }) => lesson.data.id));
const issues = [...glossary.issues, ...checkGlossary(glossary.entries, { lessonIds })];
for (const issue of issues) {
  console.log(
    `${issue.path}${issue.where ? ` (${issue.where})` : ''}: ${issue.message} [${issue.rule}]`,
  );
}
console.log(`glossary: ${glossary.entries.length} words, ${issues.length} issues.`);
process.exitCode = issues.length > 0 ? 1 : 0;
