import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { CHALLENGE_FILES, validLessonInput } from '../../core/content/fixtures';

export const REPO = path.resolve(import.meta.dirname, '../../../..');

export const LESSON_DIR = 'content/course/03-javascript/01-coercion';

export const MODULE_INPUT = {
  id: 'js',
  number: 3,
  title: 'JavaScript',
  summary: 'The language of the cart.',
  why: 'Every later chapter builds on it.',
      youCanBuild: 'A client-side cart.',
  concepts: [{ id: 'js.coercion', title: 'Type coercion', summary: 'Implicit conversion.' }],
};

/** A small, valid content tree, as files. Tests overwrite single entries to break it. */
export function fixtureTree(): Record<string, string> {
  return {
    'content/course/course.yaml': stringify({
      title: 'The course',
      summary: 'From a page to a system.',
    }),
    'content/course/03-javascript/module.yaml': stringify(MODULE_INPUT),
    [`${LESSON_DIR}/lesson.yaml`]: stringify(validLessonInput()),
    ...Object.fromEntries(
      Object.entries(CHALLENGE_FILES).map(([name, source]) => [`${LESSON_DIR}/${name}`, source]),
    ),
  };
}

export function makeRoot(tree: Record<string, string> = fixtureTree()): string {
  const root = mkdtempSync(path.join(tmpdir(), 'understory-content-'));
  for (const [rel, contents] of Object.entries(tree)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), contents);
  }
  return root;
}

export const removeRoot = (root: string): void => rmSync(root, { recursive: true, force: true });

/** A temporary copy of the real content/, so a test can break one file of it. */
export function copyOfRealContent(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'understory-real-'));
  cpSync(path.join(REPO, 'content'), path.join(root, 'content'), { recursive: true });
  return root;
}

export interface CliResult {
  code: number;
  stdout: string;
}

export function runScript(script: string, root: string, args: string[] = []): CliResult {
  try {
    const stdout = execFileSync('node', ['--import', 'tsx', path.join(REPO, script), ...args], {
      cwd: REPO,
      env: { ...process.env, CONTENT_ROOT: root, NO_COLOR: '1' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err) {
    const failed = err as { status?: number; stdout?: string; stderr?: string };
    return { code: failed.status ?? -1, stdout: `${failed.stdout ?? ''}${failed.stderr ?? ''}` };
  }
}
