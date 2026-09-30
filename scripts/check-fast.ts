/**
 * The everyday check, run with `pnpm check:fast`. The four parts share no state, so they
 * run side by side and the wall time is the slowest one: about a minute.
 *
 *   content   every rule on every file; solutions only for the lessons you changed
 *   lint      ESLint and Prettier
 *   types     every tsconfig
 *   unit      the core, adapter, script and UI suites (not the whole-course build tests)
 *
 * `pnpm check` is the full release check: every solution, the audit, coverage, the
 * whole-course build tests and a production build.
 */
import { spawn } from 'node:child_process';

const PARTS: [name: string, command: string][] = [
  ['content', 'pnpm validate:content --changed'],
  ['lint', 'pnpm lint'],
  ['types', 'pnpm typecheck'],
  ['unit', 'pnpm test:unit'],
];

interface Outcome {
  name: string;
  ok: boolean;
  seconds: number;
  output: string;
}

function run(name: string, command: string): Promise<Outcome> {
  const started = Date.now();
  return new Promise((resolve) => {
    // Output is held back and printed once per part, so four parts never interleave.
    const child = spawn(command, { shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('close', (code) =>
      resolve({ name, ok: code === 0, seconds: (Date.now() - started) / 1000, output }),
    );
  });
}

async function main(): Promise<number> {
  const outcomes = await Promise.all(PARTS.map(([name, command]) => run(name, command)));
  for (const failed of outcomes.filter((outcome) => !outcome.ok)) {
    console.log(`\n── ${failed.name} failed ──\n${failed.output.trimEnd()}`);
  }
  console.log('');
  for (const { name, ok, seconds } of outcomes) {
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(8)} ${seconds.toFixed(0).padStart(4)} s`);
  }
  return outcomes.every((outcome) => outcome.ok) ? 0 : 1;
}

// No top-level await: the repo is CommonJS by default, and tsx runs this file as such.
void main().then((code) => {
  process.exitCode = code;
});
