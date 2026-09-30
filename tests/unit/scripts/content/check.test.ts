import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkContent } from '../../../../scripts/lib/check';
import type { SolutionGate } from '../../../../scripts/lib/solution-gate';
import { stringify } from 'yaml';
import { CHALLENGE_FILES, validLessonInput } from '../../core/content/fixtures';
import { fixtureTree, LESSON_DIR, makeRoot, removeRoot } from './helpers';

const roots: string[] = [];
const rootWith = (changes: Record<string, string> = {}): string => {
  const root = makeRoot({ ...fixtureTree(), ...changes });
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

describe('checkContent', () => {
  it('joins read issues and rule issues in one list', async () => {
    const { issues, checked } = await checkContent(rootWith());
    // The fixture has no lock file yet, and that is the only thing to say about it.
    expect(issues.map((issue) => issue.rule)).toEqual(['lock-stale']);
    expect(checked).toBe(3);
  });

  it('calls the solution gate once per code challenge, with the sources', async () => {
    const gate = vi.fn<SolutionGate>(() => Promise.resolve([]));
    await checkContent(rootWith(), gate);
    expect(gate).toHaveBeenCalledTimes(1);
    const [lesson, step, files] = gate.mock.calls[0] ?? [];
    expect(lesson?.data.id).toBe('js.coercion');
    expect(step?.id).toBe('write-total');
    expect(files).toEqual({
      starter: CHALLENGE_FILES['starter.ts'],
      solution: CHALLENGE_FILES['solution.ts'],
      tests: CHALLENGE_FILES['tests.ts'],
    });
  });

  it('gates a twin as a step of its own, and names it in what it finds', async () => {
    const input = validLessonInput() as { steps: Record<string, unknown>[] };
    const step = input.steps.find((s) => s.type === 'code-challenge');
    if (!step) throw new Error('The fixture has a challenge.');
    step.twin = {
      language: 'python',
      starter: 'starter.py',
      solution: 'solution.py',
      tests: 'tests.py',
    };
    const root = rootWith({
      [`${LESSON_DIR}/lesson.yaml`]: stringify(input),
      [`${LESSON_DIR}/starter.py`]: 'def total(): pass\n',
      [`${LESSON_DIR}/solution.py`]: 'def total(): return 1\n',
      [`${LESSON_DIR}/tests.py`]: 'def test_total(): assert total() == 1\n',
    });
    const gate = vi.fn<SolutionGate>((lesson, gated) =>
      Promise.resolve([
        {
          severity: 'error',
          rule: 'solution-gate',
          path: lesson.path,
          where: gated.id,
          message: `The ${gated.language} solution fails.`,
        },
      ]),
    );
    const { issues } = await checkContent(root, gate);
    expect(gate).toHaveBeenCalledTimes(2);
    const [, twin, files] = gate.mock.calls[1] ?? [];
    expect(twin).toMatchObject({ id: 'write-total', language: 'python', starter: 'starter.py' });
    expect(files).toEqual({
      starter: 'def total(): pass\n',
      solution: 'def total(): return 1\n',
      tests: 'def test_total(): assert total() == 1\n',
    });
    const gated = issues.filter((issue) => issue.rule === 'solution-gate');
    expect(gated.map((issue) => issue.where)).toEqual(['write-total', 'write-total, Python twin']);
  });

  it('reports what the gate finds', async () => {
    const gate: SolutionGate = (lesson, step) =>
      Promise.resolve([
        {
          severity: 'error',
          rule: 'solution-fails',
          path: lesson.path,
          where: step.id,
          message: 'The reference solution fails its tests.',
        },
      ]);
    const { issues } = await checkContent(rootWith(), gate);
    expect(issues.map((issue) => issue.rule)).toContain('solution-fails');
  });

  it('skips the gate for a challenge with a missing file', async () => {
    const gate = vi.fn<SolutionGate>(() => Promise.resolve([]));
    const tree = fixtureTree();
    delete tree[`${LESSON_DIR}/solution.ts`];
    const root = makeRoot(tree);
    roots.push(root);
    const { issues } = await checkContent(root, gate);
    expect(gate).not.toHaveBeenCalled();
    expect(issues.map((issue) => issue.rule)).toContain('challenge-file-missing');
  });

  it('keeps quiet about references into an unreadable file', async () => {
    const root = rootWith({ 'content/course/03-javascript/module.yaml': 'id: "unclosed' });
    const { issues } = await checkContent(root);
    // Without the module, every concept of the lesson would look undefined.
    expect(issues.map((issue) => issue.rule)).toEqual(['yaml-syntax']);
  });

  it('keeps quiet about the lock while a file is unreadable', async () => {
    // Otherwise every id of the unreadable lesson is reported as removed: one slip, forty errors.
    const lock = { schema: 1, published: ['step:js.coercion/intro'], retired: [] };
    const root = rootWith({
      'content/ids.lock.json': JSON.stringify(lock),
      [`${LESSON_DIR}/lesson.yaml`]: 'id: "unclosed',
    });
    const { issues } = await checkContent(root);
    expect(issues.map((issue) => issue.rule)).toEqual(['yaml-syntax']);
  });
});
