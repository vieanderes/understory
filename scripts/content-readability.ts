/**
 * Readability report. Run with `pnpm content:readability`.
 *
 * Checks every lesson against the measurable rules in docs/WRITING-GUIDE.md and prints a
 * ranked list, worst first, with a count per rule. It never fails the build: it is the
 * working list for rewriting the existing lessons. Once they pass, these rules move into
 * `pnpm validate:content` (docs/ROADMAP.md).
 *
 *   --only=<text>   limit the report to lesson paths containing <text>
 *   --detail        print every issue, not only the summary
 */
import { allLessons } from '../src/core/content/catalog';
import { readabilityOf } from '../src/core/content/readability';
import { contentRoot, loadRawCatalog } from '../src/lib/content/fs';
import { formatReport } from './lib/report';

const args = process.argv.slice(2);
const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const detail = args.includes('--detail');
const colour = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

const { catalog } = loadRawCatalog(contentRoot());
const lessons = allLessons(catalog)
  .map(({ lesson }) => lesson)
  .filter((lesson) => !only || lesson.path.includes(only));

const perLesson = lessons
  .map((lesson) => ({ lesson, issues: readabilityOf(lesson.data, lesson.path) }))
  .sort((a, b) => b.issues.length - a.issues.length);

const byRule = new Map<string, number>();
for (const { issues } of perLesson) {
  for (const issue of issues) byRule.set(issue.rule, (byRule.get(issue.rule) ?? 0) + 1);
}

if (detail) {
  process.stdout.write(
    formatReport(
      perLesson.flatMap((entry) => entry.issues),
      { colour, strict: false, checked: perLesson.length },
    ),
  );
}

console.log(`\nReadability: ${perLesson.length} lessons\n`);
console.log('By rule');
for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}  ${rule}`);
}
console.log('\nBy lesson, most to fix first');
for (const { lesson, issues } of perLesson) {
  console.log(`  ${String(issues.length).padStart(5)}  ${lesson.data.id}`);
}
const clean = perLesson.filter((entry) => entry.issues.length === 0).length;
console.log(`\n${clean} of ${perLesson.length} lessons meet every measurable rule.`);
