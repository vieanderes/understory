/**
 * The online-test gates alone, fast enough to run while authoring one task:
 *
 *   pnpm online-tests:check                 every task and preset
 *   pnpm online-tests:check --only=<text>   only problems whose path contains <text>
 *
 * `pnpm validate:content` runs the same gates with everything else.
 */
import { contentRoot } from '../src/lib/content/fs';
import { checkOnlineTests, loadOnlineTests } from './lib/online-tests';
import { exitCodeFor, formatReport } from './lib/report';

const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const colour = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

async function main(): Promise<number> {
  let issues = await checkOnlineTests(contentRoot(), { gates: true, ...(only ? { only } : {}) });
  if (only) issues = issues.filter((issue) => issue.path.includes(only));
  process.stdout.write(
    formatReport(issues, {
      colour,
      strict: true,
      checked: loadOnlineTests(contentRoot()).tasks.length,
    }),
  );
  return exitCodeFor(issues, true);
}

void main().then((code) => {
  process.exitCode = code;
});
