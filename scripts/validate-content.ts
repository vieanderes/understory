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
 *
 * Exit code 1 means at least one error. It stays fast on purpose: no markdown rendering
 * and no highlighting happen here, so an author can run it on every save.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCK_PATH } from '../src/core/content/catalog';
import { nextLock } from '../src/core/content/lock';
import { contentRoot } from '../src/lib/content/fs';
import { checkContent } from './lib/check';
import { exitCodeFor, formatReport } from './lib/report';
import { nodeSolutionGate } from './lib/node-solution-gate';
import { jsdomPlaygroundGate, noPlaygroundGate } from './lib/playground-gate';
import { noSolutionGate } from './lib/solution-gate';
import { noSqlGate, pgliteSqlGate } from './lib/sql-gate';
import { checkOnlineTests } from './lib/online-tests';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const writeLock = args.has('--write-lock');
// Skips running solutions: for tests of the rules and the lock, which would otherwise pay
// for a full run of every challenge, playground and sql step on each call.
const gates = !args.has('--no-gates');
const only = [...args].find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const colour = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

async function main(): Promise<number> {
  const root = contentRoot();
  // Every reference solution must pass its tests and every starter must not. The gate
  // runs them in the same harness the browser uses (docs/SANDBOX.md). Every sql solution
  // must run on the same Postgres the browser uses, and every sql starter must fall short.
  const result = gates
    ? await checkContent(root, nodeSolutionGate, jsdomPlaygroundGate, pgliteSqlGate)
    : await checkContent(root, noSolutionGate, noPlaygroundGate, noSqlGate);
  let { issues } = result;
  issues = [...issues, ...(await checkOnlineTests(root, { gates }))];

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
