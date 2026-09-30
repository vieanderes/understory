import { describe, expect, it } from 'vitest';
import { gateScope, inGateScope } from '../../../scripts/lib/gate-scope';

const LESSON = 'content/course/07-nextjs/04-loading-data/lesson.yaml';

describe('gateScope', () => {
  it('runs no gate when no lesson or gate input changed', () => {
    expect(gateScope(['README.md', 'src/features/tutor/StudyAssistant.tsx'])).toEqual({
      kind: 'none',
    });
  });

  it('runs only the gates of the lessons that changed', () => {
    const scope = gateScope([
      LESSON,
      'content/course/07-nextjs/04-loading-data/solution.ts',
      'content/course/03-javascript/02-values-types-coercion/tests.js',
    ]);
    expect(scope).toEqual({
      kind: 'lessons',
      dirs: [
        'content/course/03-javascript/02-values-types-coercion/',
        'content/course/07-nextjs/04-loading-data/',
      ],
    });
    expect(inGateScope(scope, `/repo/${LESSON}`)).toBe(true);
    expect(inGateScope(scope, '/repo/content/course/07-nextjs/05-caching/lesson.yaml')).toBe(false);
  });

  it.each([
    'scripts/lib/node-solution-gate.ts',
    'src/core/grading/grade.ts',
    'src/adapters/node-runner/worker-source.ts',
    'content/harness.d.ts',
    'content/online-tests/tasks/scoreboard/task.yaml',
    'content/course/07-nextjs/module.yaml',
    'pnpm-lock.yaml',
  ])('runs every gate when %s changed, since every lesson depends on it', (path) => {
    expect(gateScope([LESSON, path])).toEqual({ kind: 'all' });
  });
});
