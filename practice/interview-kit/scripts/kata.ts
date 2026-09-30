/**
 * pnpm kata <name> [--solution] [--watch]
 *
 * Runs one kata's visible tests. By default they run against your code in `src/`. With
 * --solution the same tests run against the reference in `solution/`, which is how you
 * check the tests themselves, or peek when stuck.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const katasDir = path.join(root, 'katas');
const katas = readdirSync(katasDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const args = process.argv.slice(2);
const name = args.find((arg) => !arg.startsWith('-'));
const solution = args.includes('--solution');
const watch = args.includes('--watch');

if (!name || !katas.includes(name)) {
  if (name) console.error(`No kata called "${name}".`);
  console.log('Usage: pnpm kata <name> [--solution] [--watch]\n\nKatas:');
  for (const kata of katas) console.log(`  ${kata}`);
  process.exit(name ? 1 : 0);
}

const env = { ...process.env, KATA_TARGET: solution ? 'solution' : 'starter' };
console.log(
  `Running ${name} against ${solution ? 'the reference solution' : 'your code in src/'}.\n`,
);

const kataDir = path.join(katasDir, name);
const isPython = existsSync(path.join(kataDir, 'pytest.ini'));

const result = isPython
  ? spawnSync(process.env.PYTHON ?? 'python3', ['-m', 'pytest', kataDir], {
      cwd: root,
      env,
      stdio: 'inherit',
    })
  : spawnSync(
      path.join(root, 'node_modules', '.bin', 'vitest'),
      [watch ? 'watch' : 'run', path.relative(root, kataDir)],
      { cwd: root, env, stdio: 'inherit' },
    );

if (result.error) {
  console.error(result.error.message);
  if (isPython) console.error('Is pytest installed? See katas/python-katas/README.md.');
  process.exit(1);
}
process.exit(result.status ?? 1);
