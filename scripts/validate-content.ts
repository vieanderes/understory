/**
 * Content check. Run with `pnpm validate:content`.
 *
 * Reads everything under content/, checks each file against its schema and the catalog
 * against the rules in src/core/content/validate.ts, and prints the problems grouped by
 * file in plain English.
 *
 *   --strict       warnings fail the run too (CI on main)
 *   --write-lock   record the ids of the current content in content/ids.lock.json
 *   --only=<text>  report only problems whose file path contains <text>. For authors who
 *                  work on one lesson while others are mid-edit elsewhere. Never for CI.
 *   --changed      run solutions only for the lessons changed since main (committed, staged,
 *                  unstaged or new), or for all of them when a shared input changed
 *                  (scripts/lib/gate-scope.ts). Every rule still checks every file.
 *
 * Exit code 1 means at least one error. It stays fast on purpose: no markdown rendering
 * and no highlighting happen here, so an author can run it on every save.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { LOCK_PATH } from '../src/core/content/catalog';
import { nextLock } from '../src/core/content/lock';
import { contentRoot } from '../src/lib/content/fs';
import { checkContent } from './lib/check';
import { gateScope, inGateScope, type GateScope } from './lib/gate-scope';
import { exitCodeFor, formatReport } from './lib/report';
import { nodeSolutionGate } from './lib/node-solution-gate';
import { jsdomPlaygroundGate, noPlaygroundGate, type PlaygroundGate } from './lib/playground-gate';
import { noSolutionGate, type SolutionGate } from './lib/solution-gate';
import { noSqlGate, pgliteSqlGate, type SqlGate } from './lib/sql-gate';
import { checkOnlineTests } from './lib/online-tests';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const writeLock = args.has('--write-lock');
// Skips running solutions: for tests of the rules and the lock, which would otherwise pay
// for a full run of every challenge, playground and sql step on each call.
const gates = !args.has('--no-gates');
const only = [...args].find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const changedOnly = args.has('--changed');
const colour = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

/** Files changed since main, plus staged, unstaged and new ones. Null when git cannot say. */
function changedPaths(): string[] | null {
  const git = (...gitArgs: string[]) =>
    execFileSync('git', gitArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .filter(Boolean);
  try {
    const base = git('merge-base', 'HEAD', 'origin/main')[0] ?? 'HEAD';
    return [
      ...git('diff', '--name-only', base),
      ...git('ls-files', '--others', '--exclude-standard'),
    ];
  } catch {
    return null;
  }
}

function describeScope(scope: GateScope): string {
  if (scope.kind === 'all') return 'every lesson';
  if (scope.kind === 'none') return 'no lesson (none changed)';
  return `${scope.dirs.length} changed lesson${scope.dirs.length === 1 ? '' : 's'}`;
}

async function main(): Promise<number> {
  const root = contentRoot();
  const changed = changedOnly ? changedPaths() : null;
  const scope: GateScope = changed ? gateScope(changed) : { kind: 'all' };
  if (gates && changedOnly) console.log(`Running solutions for ${describeScope(scope)}.`);

  // Every reference solution must pass its tests and every starter must not. The gate
  // runs them in the same harness the browser uses (docs/SANDBOX.md). Every sql solution
  // must run on the same Postgres the browser uses, and every sql starter must fall short.
  const solutionGate: SolutionGate = (lesson, step, files) =>
    inGateScope(scope, lesson.path)
      ? nodeSolutionGate(lesson, step, files)
      : noSolutionGate(lesson, step, files);
  const playgroundGate: PlaygroundGate = (lesson, step) =>
    inGateScope(scope, lesson.path)
      ? jsdomPlaygroundGate(lesson, step)
      : noPlaygroundGate(lesson, step);
  const sqlGate: SqlGate = (items) =>
    pgliteSqlGate(items.filter((item) => inGateScope(scope, item.lesson.path)));

  const result = gates
    ? await checkContent(root, solutionGate, playgroundGate, sqlGate)
    : await checkContent(root, noSolutionGate, noPlaygroundGate, noSqlGate);
  let { issues } = result;
  // A change to a task or to the gates widens the scope to all, so a narrower scope means
  // no online-test input changed.
  issues = [...issues, ...(await checkOnlineTests(root, { gates: gates && scope.kind === 'all' }))];

  if (writeLock) {
    if (issues.some((issue) => issue.severity === 'error')) {
      process.stdout.write(formatReport(issues, { colour, strict, checked: result.checked }));
      console.log('The lock was not written. Fix the errors first, so no broken id is recorded.');
      return 1;
    }
    const lock = nextLock(result.catalog, result.catalog.lock);
    fs.writeFileSync(path.join(root, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`Wrote ${LOCK_PATH} with ${lock.published.length} published ids.`);
    issues = issues.filter((issue) => issue.rule !== 'lock-stale');
  }

  if (only) issues = issues.filter((issue) => issue.path.includes(only));
  process.stdout.write(formatReport(issues, { colour, strict, checked: result.checked }));
  return exitCodeFor(issues, strict);
}

// No top-level await: the repo is CommonJS by default, and tsx runs this file as such.
void main().then((code) => {
  process.exitCode = code;
});
