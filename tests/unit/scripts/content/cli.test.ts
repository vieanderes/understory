import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { jsonSchemas } from '../../../../scripts/lib/json-schema';
import { copyOfRealContent, removeRoot, REPO, runScript } from './helpers';

/*
 * End-to-end: the real scripts, run as a child process against a temporary copy of the
 * real content with one thing broken, as an author would break it.
 */

const VALIDATE = 'scripts/validate-content.ts';
const BUILD = 'scripts/build-content.ts';
const COERCION = 'content/course/03-javascript/02-values-types-coercion/lesson.yaml';

const roots: string[] = [];
function brokenCopy(rel: string, edit: (text: string) => string): string {
  const root = copyOfRealContent();
  roots.push(root);
  const file = path.join(root, rel);
  const before = readFileSync(file, 'utf8');
  const after = edit(before);
  if (after === before) throw new Error(`the edit did not change ${rel}`);
  writeFileSync(file, after);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort();

// A full validation runs every challenge through the solution gate, assessments with their
// timed performance and brute-force checks, and one test here validates three times. Alone
// on a CI runner it takes about three minutes, and longer beside the other test processes,
// so the limit leaves room for the course to grow.
describe('validate-content.ts', { timeout: 600_000 }, () => {
  it('passes on the real content, even under --strict', () => {
    const { code, stdout } = runScript(VALIDATE, REPO, ['--strict']);
    expect(stdout).toContain('no problems');
    expect(code).toBe(0);
  });

  it('a misspelt key: names the key, the file and the line, and exits 1', () => {
    const root = brokenCopy(COERCION, (text) => text.replace(/^title:/m, 'tittle:'));
    const { code, stdout } = runScript(VALIDATE, root, ['--no-gates']);
    expect(code).toBe(1);
    expect(stdout).toContain(COERCION);
    expect(stdout).toContain('Unknown key "tittle"');
    expect(stdout).toContain('Missing "title". The lesson title. A noun phrase.');
    // The other lesson lists this one as a prerequisite. That must not add a third error.
    // The file count grows with the course, so only the error count is pinned.
    expect(stdout).toMatch(/\d+ files checked: 2 errors, 0 warnings\./);
  });

  it('a YAML syntax slip: reports the line and does not crash', () => {
    const root = brokenCopy(COERCION, (text) =>
      text.replace(/^title: .*$/m, 'title: Values: types and coercion'),
    );
    const { code, stdout } = runScript(VALIDATE, root, ['--no-gates']);
    expect(code).toBe(1);
    expect(stdout).toContain('line 2');
    expect(stdout).toContain('Put the whole value in quotes');
    expect(stdout).not.toContain('at ');
    expect(stdout).not.toContain('lock-id-removed');
  });

  it('two correct choices: names the step', () => {
    const root = brokenCopy(COERCION, (text) =>
      text.replace("      - text: '`3`'\n", "      - text: '`3`'\n        correct: true\n"),
    );
    const { code, stdout } = runScript(VALIDATE, root, ['--no-gates']);
    expect(code).toBe(1);
    expect(stdout).toContain('predict-total: choices: exactly one entry needs "correct: true", found 2.');
    expect(stdout).toContain('[one-correct]');
  });

  it('a style slip is a warning: exit 0, or exit 1 under --strict', () => {
    const root = brokenCopy(COERCION, (text) =>
      text.replace('A form field always hands', 'A form field simply hands'),
    );
    const relaxed = runScript(VALIDATE, root, ['--no-gates']);
    expect(relaxed.stdout).toContain('warning  strings-from-forms: body: Remove "simply".');
    expect(relaxed.stdout).toContain('0 errors, 1 warning.');
    expect(relaxed.code).toBe(0);
    expect(runScript(VALIDATE, root, ['--no-gates', '--strict']).code).toBe(1);
  });

  it('a renamed step id: the lock explains what to do', () => {
    const root = brokenCopy(COERCION, (text) => text.replace('id: predict-total', 'id: predict-sum'));
    const { code, stdout } = runScript(VALIDATE, root, ['--no-gates']);
    expect(code).toBe(1);
    expect(stdout).toContain('content/ids.lock.json');
    expect(stdout).toContain('"step:js.coercion/predict-total" is no longer in the content');
    expect(stdout).toContain('retired');
  });

  it('a missing solution file: names the file and the step', () => {
    const root = copyOfRealContent();
    roots.push(root);
    rmSync(path.join(root, path.dirname(COERCION), 'solution.js'));
    const { code, stdout } = runScript(VALIDATE, root, ['--no-gates']);
    expect(code).toBe(1);
    expect(stdout).toContain('write-cart-total: The file "solution.js" does not exist');
  });

  it('--write-lock records new ids and the next run is clean', () => {
    const root = brokenCopy(COERCION, (text) => text.replace('id: card-falsy-values', 'id: card-falsy'));
    const lockPath = path.join(root, 'content/ids.lock.json');
    // Retire the old id by hand, as an author would, then let the tool add the new one.
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as { retired: string[] };
    lock.retired.push('card:js.coercion/card-falsy-values');
    writeFileSync(lockPath, JSON.stringify(lock));

    expect(runScript(VALIDATE, root, ['--no-gates']).stdout).toContain('[lock-stale]');
    const written = runScript(VALIDATE, root, ['--no-gates', '--write-lock']);
    expect(written.code).toBe(0);
    expect(written.stdout).toContain('Wrote content/ids.lock.json');
    expect(readFileSync(lockPath, 'utf8')).toContain('"card:js.coercion/card-falsy"');
    expect(runScript(VALIDATE, root, ['--no-gates', '--strict']).code).toBe(0);
  });

  it('--write-lock refuses while there are errors', () => {
    const root = brokenCopy(COERCION, (text) => text.replace(/^title:/m, 'tittle:'));
    const before = readFileSync(path.join(root, 'content/ids.lock.json'), 'utf8');
    const { code, stdout } = runScript(VALIDATE, root, ['--no-gates', '--write-lock']);
    expect(code).toBe(1);
    expect(stdout).toContain('The lock was not written');
    expect(readFileSync(path.join(root, 'content/ids.lock.json'), 'utf8')).toBe(before);
  });
});

/** Every lesson.yaml under a content root, however deep the module folders go. */
function countLessons(contentDir: string): number {
  return readdirSync(contentDir, { recursive: true, encoding: 'utf8' }).filter(
    (name) => path.basename(name) === 'lesson.yaml',
  ).length;
}

// Each test builds the whole course, some twice: about a minute a build on a CI runner.
describe('build-content.ts', { timeout: 240_000 }, () => {
  it('writes the bundle and the contracts, and a second run is byte-identical', () => {
    const root = copyOfRealContent();
    roots.push(root);
    const first = runScript(BUILD, root);
    expect(first.code).toBe(0);

    // The course grows, so the count comes from the content, never from a pinned number.
    const lessonCount = countLessons(path.join(root, 'content'));
    expect(first.stdout).toContain(`build:content: ${lessonCount} lessons`);

    const bundle = path.join(root, 'public/content/v1');
    const names = filesUnder(bundle);
    expect(names).toContain('manifest.json');
    expect(names.filter((name) => name.startsWith('lessons/'))).toHaveLength(lessonCount);
    // Only a lesson with a code challenge ships solutions, so this is a subset.
    expect(names.filter((name) => name.startsWith('solutions/')).length).toBeGreaterThan(0);
    expect(names).toContain('placement.json');
    expect(filesUnder(path.join(root, 'contracts/schemas'))).toHaveLength(6);

    const snapshot = names.map((name) => readFileSync(path.join(bundle, name), 'utf8'));
    // A leftover from an older build must go, and nothing else may change.
    writeFileSync(path.join(bundle, 'lessons/js.gone.000000000000.json'), '{}');
    expect(runScript(BUILD, root).code).toBe(0);
    expect(filesUnder(bundle)).toEqual(names);
    expect(names.map((name) => readFileSync(path.join(bundle, name), 'utf8'))).toEqual(snapshot);
  });

  it('keeps reference solutions out of the lesson files', () => {
    const root = copyOfRealContent();
    roots.push(root);
    runScript(BUILD, root);
    const lessons = path.join(root, 'public/content/v1/lessons');
    for (const name of readdirSync(lessons)) {
      const text = readFileSync(path.join(lessons, name), 'utf8');
      expect(text).not.toContain('Number.isInteger(quantity) || quantity < 1) continue');
      expect(text).not.toContain('only the two functions');
      // Design 02's solution. Lesson text may hold hex colours since Design 04, so a hex is no canary.
      expect(text).not.toContain('while (!seen.includes(current))');
    }
  });

  it('refuses to build content with an error, and writes nothing', () => {
    const root = brokenCopy(COERCION, (text) => text.replace(/^title:/m, 'tittle:'));
    const { code, stdout } = runScript(BUILD, root);
    expect(code).toBe(1);
    expect(stdout).toContain('Unknown key "tittle"');
    expect(stdout).toContain('Nothing was written');
    expect(existsSync(path.join(root, 'public'))).toBe(false);
  });
});

describe('contracts/schemas', () => {
  it('is up to date with the zod schemas (run pnpm build:content to refresh)', () => {
    for (const [file, text] of jsonSchemas()) {
      expect(readFileSync(path.join(REPO, 'contracts/schemas', file), 'utf8'), file).toBe(text);
    }
  });
});
