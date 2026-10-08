import fs from 'node:fs';
import path from 'node:path';
import type { Issue, RawCatalog, RawLesson } from '../../src/core/content/catalog';
import { LAB_INFO } from '../../src/core/labs/catalog';
import { allLessons } from '../../src/core/content/catalog';
import type { CodeChallengeStep } from '../../src/core/content/schema';
import { challengeVariants, languageLabel } from '../../src/core/content/twin';
import {
  validateFastTrack,
  validateLectures,
  validateTestsOnPaths,
  type OnlineTestIds,
} from '../../src/core/content/notes-check';
import { checkGlossary } from '../../src/core/content/glossary-schema';
import { validateCatalog, validateOutline } from '../../src/core/content/validate';
import { contentRoot, loadGlossary, loadRawCatalog, loadTracks } from '../../src/lib/content/fs';
import { loadOutline, readInterestLessonIds } from '../../src/lib/content/outline';
import { checkPlacementContent, PLACEMENT_PATH } from './placement';
import { jsdomPlaygroundGate, type PlaygroundGate } from './playground-gate';
import { noSolutionGate } from './solution-gate';
import { noSqlGate, type SqlGate } from './sql-gate';
import type { ChallengeSources, SolutionGate } from './solution-gate';

/* One full check of the content tree, shared by the validator CLI and the build. */

export interface CheckResult {
  catalog: RawCatalog;
  issues: Issue[];
  checked: number;
}

/**
 * Rules that look things up in other files. An unreadable file is missing from the
 * catalog, so these rules would blame its neighbours: the lock would call every id in it
 * "removed", and a lesson that requires it would have an "unknown" prerequisite. The read
 * error is the real problem and the only one worth showing, so these wait until it is fixed.
 */
const NEEDS_WHOLE_CATALOG: ReadonlySet<string> = new Set([
  'lock-id-removed',
  'lock-id-reused',
  'lock-stale',
  'concept-unknown',
  'concept-foreign-module',
  'confusable-unknown',
  'prerequisite-unknown',
  'outline-module-unknown',
  'outline-concept-unknown',
  'outline-concept-foreign',
  'outline-concept-unused',
  'outline-lesson-unplanned',
  'outline-lesson-dir',
  'fast-track-unknown-lesson',
  'fast-track-no-notes',
  'fast-track-unknown-part',
  'fast-track-unknown-guide',
]);

function sourcesOf(lesson: RawLesson, step: CodeChallengeStep): ChallengeSources | undefined {
  const starter = lesson.files[step.starter];
  const solution = lesson.files[step.solution];
  const tests = lesson.files[step.tests];
  // A missing file is already an issue. Running the gate on half a challenge adds noise.
  if (starter === undefined || solution === undefined || tests === undefined) return undefined;
  const optional = (name: string | undefined) =>
    name === undefined ? undefined : lesson.files[name];
  const hidden = optional(step.hidden);
  const performance = optional(step.performance);
  const bruteForce = optional(step.bruteForce);
  return {
    starter,
    solution,
    tests,
    ...(hidden === undefined ? {} : { hidden }),
    ...(performance === undefined ? {} : { performance }),
    ...(bruteForce === undefined ? {} : { bruteForce }),
  };
}

/**
 * A twin is gated as a step of its own: its solution passes its tests and its starter
 * fails them, like the main files. Its issues name the twin, so an author knows which half.
 */
async function runGate(catalog: RawCatalog, gate: SolutionGate): Promise<Issue[]> {
  const runs = allLessons(catalog).flatMap(({ lesson }) =>
    lesson.data.steps.flatMap((step) =>
      step.type !== 'code-challenge'
        ? []
        : challengeVariants(step).flatMap((variant, i) => {
            const sources = sourcesOf(lesson, variant);
            if (!sources) return [];
            const run = gate(lesson, variant, sources);
            if (i === 0) return [run];
            const where = `${step.id}, ${languageLabel(variant.language)} twin`;
            return [run.then((issues) => issues.map((issue) => ({ ...issue, where })))];
          }),
    ),
  );
  return (await Promise.all(runs)).flat();
}

/** One at a time: jsdom is quick, and a page each keeps memory flat on a large course. */
async function runPlaygroundGate(catalog: RawCatalog, gate: PlaygroundGate): Promise<Issue[]> {
  const issues: Issue[] = [];
  for (const { lesson } of allLessons(catalog)) {
    for (const step of lesson.data.steps) {
      if (step.type === 'playground') issues.push(...(await gate(lesson, step)));
    }
  }
  return issues;
}

function sqlSteps(catalog: RawCatalog) {
  return allLessons(catalog).flatMap(({ lesson }) =>
    lesson.data.steps.flatMap((step) => (step.type === 'sql' ? [{ lesson, step }] : [])),
  );
}

/** The preset and task ids in content/online-tests, by folder name; none in a fixture tree. */
function readOnlineTestIds(root: string): OnlineTestIds | undefined {
  const dir = path.join(root, 'content/online-tests');
  if (!fs.existsSync(dir)) return undefined;
  const list = (sub: string) =>
    fs.existsSync(path.join(dir, sub))
      ? fs.readdirSync(path.join(dir, sub), { withFileTypes: true })
      : [];
  return {
    presets: new Set(
      list('tests')
        .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
        .map((entry) => entry.name.replace(/\.yaml$/, '')),
    ),
    tasks: new Set(
      list('tasks')
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    ),
    labs: new Set(LAB_INFO.map((lab) => lab.id)),
  };
}

/**
 * The playground gate runs by default: it needs no runner, only jsdom, and it is what
 * tells an author that a checklist cannot be passed.
 */
export async function checkContent(
  root?: string,
  gate: SolutionGate = noSolutionGate,
  playgroundGate: PlaygroundGate = jsdomPlaygroundGate,
  // Off by default like the solution gate: starting Postgres takes seconds, and
  // scripts/validate-content.ts turns it on.
  sqlGate: SqlGate = noSqlGate,
): Promise<CheckResult> {
  const { catalog, issues: readIssues, checked } = loadRawCatalog(root);
  const unreadable = readIssues.some((issue) => issue.severity === 'error');
  const outline = loadOutline(root);
  const tracks = loadTracks(root);
  const onlineTests = readOnlineTestIds(root ?? contentRoot());
  const plans = Object.values(tracks.tracks);
  const ruleIssues = [
    ...validateCatalog(catalog),
    ...validateLectures(catalog),
    ...tracks.issues,
    ...plans.flatMap((track) => validateFastTrack(catalog, track.path, track.data, onlineTests)),
    ...(onlineTests && plans.length > 0
      ? validateTestsOnPaths(
          plans.map((track) => track.data),
          onlineTests,
        )
      : []),
    ...validateOutline({
      catalog,
      ...(outline.outline ? { outline: outline.outline } : {}),
      interestLessonIds: readInterestLessonIds(root),
    }),
  ].filter((issue) => !(unreadable && NEEDS_WHOLE_CATALOG.has(issue.rule)));
  // A content tree without placement (a test fixture) has nothing to check.
  const hasPlacement = fs.existsSync(path.join(root ?? contentRoot(), PLACEMENT_PATH));
  const placementIssues = hasPlacement && !unreadable ? checkPlacementContent(catalog, root) : [];
  const glossary = loadGlossary(root);
  const lessonIds = new Set(allLessons(catalog).map(({ lesson }) => lesson.data.id));
  const glossaryIssues = [
    ...glossary.issues,
    // An unreadable lesson would make every word that pins it look wrong.
    ...checkGlossary(glossary.entries, { lessonIds }).filter(
      (issue) => !(unreadable && issue.rule === 'glossary-lesson-unknown'),
    ),
  ];
  return {
    catalog,
    issues: [
      ...readIssues,
      ...outline.issues,
      ...ruleIssues,
      ...placementIssues,
      ...glossaryIssues,
      ...(await runGate(catalog, gate)),
      ...(await runPlaygroundGate(catalog, playgroundGate)),
      ...(await sqlGate(sqlSteps(catalog))),
    ],
    checked: checked + outline.checked + glossary.checked,
  };
}
