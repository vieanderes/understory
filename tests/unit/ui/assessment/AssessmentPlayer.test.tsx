import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledCodeChallengeStep, CompiledLesson } from '@/core/content/compiled';
import type { RunRequest, RunResult } from '@/core/ports/code-runner';
import type { LazyCodeEditorProps } from '@/features/editor/LazyCodeEditor';

vi.mock('@/features/editor/LazyCodeEditor', () => ({
  LazyCodeEditor: ({ value, onChange, readOnly, ariaLabel }: LazyCodeEditorProps) => (
    <textarea
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

const record = vi.fn(() => Promise.resolve());
vi.mock('@/features/store/StoreProvider', () => ({
  useStore: () => ({ record, getSnapshot: () => ({ state: { cards: {} } }) }),
  useProgress: () => ({ state: { modeByModule: {}, completedLessons: new Set<string>() } }),
}));
vi.mock('@/features/store/client', () => ({ requestPersistence: () => Promise.resolve() }));

const { AssessmentPlayer } = await import('@/features/assessment/AssessmentPlayer');

const rich = (text: string) => ({ md: text, html: `<p>${text}</p>` });

const TASK: CompiledCodeChallengeStep = {
  type: 'code-challenge',
  id: 'task-missing',
  concept: 'interview.hidden-tests',
  difficulty: 3,
  prompt: rich('Return the smallest missing positive integer.'),
  language: 'ts',
  starterCode: 'export function firstMissing(values: number[]): number {\n  return 0;\n}\n',
  starterHtml: '<pre><code>starter</code></pre>',
  testsCode: "test('example', () => {});",
  hiddenCode: 'HIDDEN',
  performanceCode: 'PERFORMANCE',
  timeLimitMs: 1500,
  hints: [rich('One'), rich('Two'), rich('Three')],
};

const LESSON: CompiledLesson = {
  schema: 1,
  id: 'interview.mock-test',
  moduleId: 'interview',
  moduleSlug: 'interview-challenges',
  slug: 'mock',
  title: 'Mock assessment',
  objective: 'Sit a timed test.',
  level: 'advanced',
  minutes: 90,
  assessment: true,
  concepts: ['interview.hidden-tests'],
  prerequisites: [],
  opening: { text: 'Ninety minutes, one task.' },
  steps: [{ type: 'prose', id: 'brief', body: rich('Read every task first.') }, TASK],
  recall: [],
  references: [],
};

/** Lists two hidden tests and one performance test; the performance test times out. */
function fakeRunner() {
  const requests: RunRequest[] = [];
  const runner = {
    dispose: vi.fn(),
    run: vi.fn((req: RunRequest): Promise<RunResult> => {
      requests.push(req);
      const only = /__only = (-?\d+)/.exec(req.tests)?.[1];
      const perf = req.tests.endsWith('PERFORMANCE');
      if (only === undefined) {
        return Promise.resolve({
          status: 'passed',
          tests: [{ name: 'example', passed: true }],
          logs: [],
        });
      }
      if (only === '-1') {
        const names = perf ? ['large: 100k'] : ['small', 'all negative'];
        return Promise.resolve({
          status: 'passed',
          tests: names.map((name) => ({ name, passed: true })),
          logs: [],
        });
      }
      if (perf) return Promise.resolve({ status: 'timeout', tests: [], logs: [] });
      return Promise.resolve({ status: 'passed', tests: [{ name: 'x', passed: true }], logs: [] });
    }),
  };
  return { runner, requests };
}

function setup() {
  const { runner, requests } = fakeRunner();
  render(
    <AssessmentPlayer
      lesson={LESSON}
      moduleTitle="Interview challenges"
      exitHref="/learn"
      next={null}
      createRunner={() => runner}
    />,
  );
  return { runner, requests };
}

beforeEach(() => {
  window.sessionStorage.clear();
  record.mockClear();
});

describe('AssessmentPlayer', () => {
  it('opens on the brief, with the rules and the time limit', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Mock assessment' })).toBeTruthy();
    expect(screen.getByText('Read every task first.')).toBeTruthy();
    expect(screen.getByText(/Hidden tests decide the score/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start the clock' })).toBeTruthy();
  });

  it('runs the examples only while the clock runs', async () => {
    const { requests } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Start the clock' }));
    expect(await screen.findByRole('timer', { name: 'Time left' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Run examples' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.tests).toBe(TASK.testsCode);
  });

  it('scores against the hidden tests on submit and records the task', async () => {
    const { requests } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Start the clock' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    expect(await screen.findByTestId('assessment-score')).toHaveProperty('textContent', '67%');
    expect(screen.getByText('Timed out')).toBeTruthy();
    // Every hidden test runs alone, with the learner's code.
    const isolated = requests.filter((r) => /__only = \d/.test(r.tests));
    expect(isolated).toHaveLength(3);
    expect(isolated.every((r) => r.code === TASK.starterCode)).toBe(true);
    expect(record).toHaveBeenCalledWith(
      'step_answered',
      expect.objectContaining({ stepId: 'task-missing', correct: false, score: 2 / 3 }),
    );
    expect(record).toHaveBeenCalledWith('lesson_completed', { lessonId: LESSON.id });
    expect(window.sessionStorage.getItem('understory:assessment:interview.mock-test')).toBeNull();
  });

  it('submits by itself when the time is up', async () => {
    // An attempt started 91 minutes ago, as after a reload or a tab left open: the
    // 90-minute clock has run out, so the code is submitted as it stands.
    window.sessionStorage.setItem(
      'understory:assessment:interview.mock-test',
      String(Date.now() - 91 * 60_000),
    );
    setup();
    expect(await screen.findByTestId('assessment-score')).toBeTruthy();
    expect(record).toHaveBeenCalledWith('lesson_completed', { lessonId: LESSON.id });
  });
});
