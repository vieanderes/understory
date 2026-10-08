import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompiledCodeChallengeStep } from '@/core/content/compiled';
import type { RunProgress, RunRequest, RunResult } from '@/core/ports/code-runner';
import type { LazyCodeEditorProps } from '@/features/editor/LazyCodeEditor';
import type { Submission } from '@/features/lesson-player/contract';
import { CodeChallengeStep } from '@/features/lesson-player/steps/CodeChallengeStep';
import { setTutorOpen, takeQueuedQuestion } from '@/features/tutor/tutor-store';

vi.mock('next/navigation', () => ({ usePathname: () => '/learn/javascript/functions' }));

// CodeMirror has its own tests (tests/unit/ui/editor) and an e2e suite. Here the editor
// is a plain field, so the step's own logic is what is under test.
vi.mock('@/features/editor/LazyCodeEditor', () => ({
  LazyCodeEditor: ({
    value,
    onChange,
    readOnly,
    ariaLabel,
    header,
    editableRegion,
  }: LazyCodeEditorProps) => (
    <>
      {header}
      <textarea
        aria-label={ariaLabel}
        data-editable={editableRegion?.lines}
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </>
  ),
}));

const rich = (text: string) => ({ md: text, html: `<p>${text}</p>` });

const STEP: CompiledCodeChallengeStep = {
  type: 'code-challenge',
  id: 'write-add',
  concept: 'js.functions',
  difficulty: 2,
  prompt: rich('Write add(a, b).'),
  language: 'ts',
  starterCode: 'export function add(a: number, b: number): number {\n  return 0;\n}\n',
  starterHtml: '<pre><code>starter</code></pre>',
  testsCode: "test('adds', () => { expect(add(1, 2)).toBe(3); });",
  hints: [rich('Hint one'), rich('Hint two'), rich('Hint three')],
};

const FAILED: RunResult = {
  status: 'failed',
  tests: [{ name: 'adds', passed: false, message: 'Expected 3, received 0' }],
  logs: [],
};
const PASSED: RunResult = { status: 'passed', tests: [{ name: 'adds', passed: true }], logs: [] };

function fakeRunner(...outcomes: RunResult[]) {
  const requests: RunRequest[] = [];
  const runner = {
    run: vi.fn(async (req: RunRequest) => {
      requests.push(req);
      return outcomes[Math.min(requests.length, outcomes.length) - 1] ?? PASSED;
    }),
    dispose: vi.fn(),
  };
  return { runner, requests };
}

function setup(options: { outcomes?: RunResult[]; solutionsUrl?: string } = {}) {
  const { runner, requests } = fakeRunner(...(options.outcomes ?? [PASSED]));
  const createRunner = vi.fn(() => runner);
  const onSubmissionChange = vi.fn<(submission: Submission | null) => void>();
  const view = render(
    <CodeChallengeStep
      step={STEP}
      phase="answering"
      reveal={false}
      seed={1}
      lessonId="js.test"
      solutionsUrl={options.solutionsUrl}
      createRunner={createRunner}
      onSubmissionChange={onSubmissionChange}
      requestCheck={vi.fn()}
    />,
  );
  return { runner, requests, createRunner, onSubmissionChange, ...view };
}

const runTests = () => userEvent.click(screen.getByRole('button', { name: 'Run tests' }));
const lastSubmission = (mock: ReturnType<typeof setup>['onSubmissionChange']) =>
  mock.mock.calls.at(-1)?.[0];

afterEach(() => {
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('CodeChallengeStep', () => {
  it('reports nothing until the first run, and says what kind of step this is', () => {
    const { onSubmissionChange, createRunner } = setup();
    expect(onSubmissionChange).not.toHaveBeenCalled();
    expect(createRunner).not.toHaveBeenCalled();
    expect(screen.getByText('Unplugged · no AI in the editor')).toBeInTheDocument();
    expect(screen.getByText('Tab indents. Escape, then Tab, leaves the editor.')).toBeVisible();
  });

  it('locks the starter outside its editable lines, and says so', () => {
    render(
      <CodeChallengeStep
        step={{ ...STEP, editable: '2' }}
        phase="answering"
        reveal={false}
        seed={1}
        lessonId="js.test"
        onSubmissionChange={vi.fn()}
        requestCheck={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Your code')).toHaveAttribute('data-editable', '2');
    expect(screen.getByText('Write the lines with the bar. The rest is locked.')).toBeVisible();
  });

  it('runs the code in the editor against the hidden tests, 3 s, in the step language', async () => {
    const { requests } = setup();
    await userEvent.type(screen.getByLabelText('Your code'), '// mine');
    await runTests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      language: 'ts',
      code: `${STEP.starterCode}// mine`,
      tests: STEP.testsCode,
      timeoutMs: 3000,
      harnessVersion: 1,
    });
  });

  it("names what a first Python run loads, then runs, and sends the step's packages", async () => {
    let release: (result: RunResult) => void = () => undefined;
    let report: (progress: RunProgress) => void = () => undefined;
    const requests: RunRequest[] = [];
    const runner = {
      run: vi.fn(
        (req: RunRequest) =>
          new Promise<RunResult>((resolve) => {
            requests.push(req);
            release = resolve;
          }),
      ),
      dispose: vi.fn(),
    };
    render(
      <CodeChallengeStep
        step={{ ...STEP, language: 'python', packages: ['numpy'] }}
        phase="answering"
        reveal={false}
        seed={1}
        lessonId="py.test"
        createRunner={(hooks) => {
          report = hooks.onProgress;
          return runner;
        }}
        onSubmissionChange={vi.fn()}
        requestCheck={vi.fn()}
      />,
    );
    await runTests();
    const status = screen.getByTestId('run-status');
    expect(status).toHaveTextContent('Running');
    act(() => report({ runId: requests[0]?.runId ?? '', loading: ['Python', 'numpy'] }));
    expect(status).toHaveTextContent('Loading Python and numpy…');
    act(() => report({ runId: requests[0]?.runId ?? '', loading: [] }));
    expect(status).toHaveTextContent('Running');
    expect(requests[0]?.packages).toEqual(['numpy']);
    await act(async () => release(PASSED));
    expect(status).toHaveTextContent('All tests pass');
  });

  it('submits the latest run with no hints and nothing revealed', async () => {
    const { onSubmissionChange } = setup({ outcomes: [FAILED, PASSED] });
    await runTests();
    expect(lastSubmission(onSubmissionChange)).toEqual({
      type: 'code-challenge',
      result: FAILED,
      hintsUsed: 0,
      revealed: false,
    });
    expect(screen.getByRole('status')).toHaveTextContent('0 of 1 pass');

    await runTests();
    expect(lastSubmission(onSubmissionChange)).toEqual({
      type: 'code-challenge',
      result: PASSED,
      hintsUsed: 0,
      revealed: false,
    });
    expect(screen.getByRole('status')).toHaveTextContent('All tests pass');
  });

  it('offers Scout as the Tutor after a failing run, with the failing tests', async () => {
    setup({ outcomes: [FAILED] });
    await runTests();
    await userEvent.click(screen.getByRole('button', { name: 'Ask Scout why' }));
    const question = takeQueuedQuestion();
    expect(question).toContain('Write add(a, b).');
    expect(question).toContain('- adds: Expected 3, received 0');
    act(() => setTutorOpen(false, { remember: false }));
  });

  it('offers Scout as the Editor after a passing run, and sends the earlier code on a revision', async () => {
    setup({ outcomes: [PASSED] });
    await runTests();
    expect(screen.queryByRole('button', { name: 'Ask Scout why' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ask Scout to review' }));
    const first = takeQueuedQuestion();
    expect(first).toContain('Review my code');
    expect(first).toContain('return 0;');
    expect(first).not.toContain('earlier version');

    const field = screen.getByRole('textbox');
    await userEvent.clear(field);
    await userEvent.type(field, 'export const add = (a: number, b: number) => a + b;');
    await runTests();
    await userEvent.click(screen.getByRole('button', { name: 'Ask Scout to review' }));
    const second = takeQueuedQuestion();
    expect(second).toContain('My earlier version');
    expect(second).toContain('a + b');
    act(() => setTutorOpen(false, { remember: false }));
  });

  it('uses one runner for every run of a mount and disposes it on unmount', async () => {
    const { createRunner, runner, unmount } = setup();
    await runTests();
    await runTests();
    expect(createRunner).toHaveBeenCalledTimes(1);
    expect(runner.run).toHaveBeenCalledTimes(2);
    unmount();
    await waitFor(() => expect(runner.dispose).toHaveBeenCalledTimes(1));
  });

  it('counts hints taken before a run', async () => {
    const { onSubmissionChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Hint 1 of 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hint 2 of 3' }));
    expect(onSubmissionChange).not.toHaveBeenCalled();
    await runTests();
    expect(lastSubmission(onSubmissionChange)).toMatchObject({ hintsUsed: 2, revealed: false });
  });

  it('updates a run already submitted when a hint is taken afterwards', async () => {
    const { onSubmissionChange } = setup({ outcomes: [FAILED] });
    await runTests();
    await userEvent.click(screen.getByRole('button', { name: 'Hint 1 of 3' }));
    expect(lastSubmission(onSubmissionChange)).toEqual({
      type: 'code-challenge',
      result: FAILED,
      hintsUsed: 1,
      revealed: false,
    });
  });

  it('runs on Ctrl+Enter from anywhere in the step', async () => {
    const { runner } = setup();
    screen.getByRole('button', { name: 'Hint 1 of 3' }).focus();
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(runner.run).toHaveBeenCalledTimes(1));
  });

  it('fetches the solution only when asked, shows it beside the code, and marks the step revealed', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ schema: 1, lessonId: 'js.test', solutions: { 'write-add': 'SOLVED' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { onSubmissionChange } = setup({ solutionsUrl: '/content/v1/solutions/x.json' });
    await userEvent.type(screen.getByLabelText('Your code'), '// mine');
    await runTests();

    for (const n of [1, 2, 3])
      await userEvent.click(screen.getByRole('button', { name: `Hint ${n} of 3` }));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Show solution' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(await screen.findByLabelText('Reference solution')).toHaveValue('SOLVED');
    expect(fetchMock).toHaveBeenCalledWith('/content/v1/solutions/x.json');
    // The learner's own code is untouched.
    expect(screen.getByLabelText('Your code')).toHaveValue(`${STEP.starterCode}// mine`);
    expect(lastSubmission(onSubmissionChange)).toMatchObject({ hintsUsed: 3, revealed: true });
  });

  it('does not count a solution that failed to load as revealed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    const { onSubmissionChange } = setup({ solutionsUrl: '/missing.json' });
    await runTests();
    for (const n of [1, 2, 3])
      await userEvent.click(screen.getByRole('button', { name: `Hint ${n} of 3` }));
    await userEvent.click(screen.getByRole('button', { name: 'Show solution' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The solution did not load');
    expect(lastSubmission(onSubmissionChange)).toMatchObject({ revealed: false });
  });

  it('keeps a draft for the tab, restores it on mount, and clears it on Reset', async () => {
    const first = setup();
    await userEvent.type(screen.getByLabelText('Your code'), '// draft');
    expect(window.sessionStorage.getItem('understory:draft:js.test#write-add')).toBe(
      `${STEP.starterCode}// draft`,
    );
    first.unmount();

    setup();
    expect(screen.getByLabelText('Your code')).toHaveValue(`${STEP.starterCode}// draft`);

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    // Asked inline first. Nothing has changed yet.
    expect(screen.getByText('Restore the starter code?')).toBeInTheDocument();
    expect(screen.getByLabelText('Your code')).toHaveValue(`${STEP.starterCode}// draft`);
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByLabelText('Your code')).toHaveValue(STEP.starterCode);
    expect(window.sessionStorage.getItem('understory:draft:js.test#write-add')).toBeNull();
  });

  it('turns a runner that cannot be created into a result, and retries on the next run', async () => {
    const onSubmissionChange = vi.fn();
    const { runner } = fakeRunner(PASSED);
    const createRunner = vi
      .fn<() => Promise<typeof runner>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue(runner);
    render(
      <CodeChallengeStep
        step={STEP}
        phase="answering"
        reveal={false}
        seed={1}
        lessonId="js.test"
        createRunner={createRunner}
        onSubmissionChange={onSubmissionChange}
        requestCheck={vi.fn()}
      />,
    );
    await runTests();
    expect(screen.getByRole('status')).toHaveTextContent('The code tools could not be loaded');
    await runTests();
    expect(screen.getByRole('status')).toHaveTextContent('All tests pass');
  });

  it('locks the code and shows the verdict once checked', async () => {
    const view = setup();
    await runTests();
    await act(async () => {
      view.rerender(
        <CodeChallengeStep
          step={STEP}
          phase="checked"
          grade={{ correct: true, score: 1, feedback: [] }}
          reveal
          seed={1}
          lessonId="js.test"
          createRunner={view.createRunner}
          onSubmissionChange={view.onSubmissionChange}
          requestCheck={vi.fn()}
        />,
      );
    });
    expect(screen.getByText('Right')).toBeInTheDocument();
    expect(screen.getByText('Every test passes, with no hints.')).toBeInTheDocument();
    expect(screen.getByLabelText('Your code')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Run tests' })).toBeDisabled();
  });
});

describe('CodeChallengeStep with a twin', () => {
  const TWIN: CompiledCodeChallengeStep = {
    ...STEP,
    typecheck: true,
    twin: {
      language: 'python',
      starterCode: 'def add(a, b):\n    return 0\n',
      starterHtml: '<pre><code>py</code></pre>',
      testsCode: 'def test_adds():\n    assert add(1, 2) == 3\n',
      packages: ['numpy'],
    },
  };

  function renderTwin(step = TWIN, extra: { solutionsUrl?: string } = {}) {
    const { runner, requests } = fakeRunner(FAILED, PASSED);
    const onSubmissionChange = vi.fn<(submission: Submission | null) => void>();
    const view = render(
      <CodeChallengeStep
        step={step}
        phase="answering"
        reveal={false}
        seed={1}
        lessonId="js.twin"
        solutionsUrl={extra.solutionsUrl}
        createRunner={() => runner}
        onSubmissionChange={onSubmissionChange}
        requestCheck={vi.fn()}
      />,
    );
    return { requests, onSubmissionChange, ...view };
  }

  const python = () => screen.getByRole('radio', { name: 'Python' });

  afterEach(() => window.localStorage.clear());

  it('offers no switch on a step without a twin', () => {
    setup();
    expect(screen.queryByRole('radiogroup', { name: 'Language' })).not.toBeInTheDocument();
  });

  it('starts in the main language and switches the starter, tests, runner and packages', async () => {
    const { requests } = renderTwin();
    expect(screen.getByRole('radio', { name: 'TypeScript' })).toBeChecked();
    expect(screen.getByLabelText('Your code')).toHaveValue(STEP.starterCode);

    await userEvent.click(python());
    expect(python()).toBeChecked();
    expect(screen.getByLabelText('Your code')).toHaveValue(TWIN.twin?.starterCode);
    await runTests();
    expect(requests[0]).toMatchObject({
      language: 'python',
      code: TWIN.twin?.starterCode,
      tests: TWIN.twin?.testsCode,
      packages: ['numpy'],
    });
  });

  it('keeps a draft per language', async () => {
    renderTwin();
    await userEvent.type(screen.getByLabelText('Your code'), '// ts');
    await userEvent.click(python());
    await userEvent.type(screen.getByLabelText('Your code'), '# py');
    await userEvent.click(screen.getByRole('radio', { name: 'TypeScript' }));
    expect(screen.getByLabelText('Your code')).toHaveValue(`${STEP.starterCode}// ts`);
    await userEvent.click(python());
    expect(screen.getByLabelText('Your code')).toHaveValue(`${TWIN.twin?.starterCode ?? ''}# py`);
  });

  it('grades the run on screen: a switch reports that language’s last run, or nothing', async () => {
    const { onSubmissionChange } = renderTwin();
    await runTests();
    expect(lastSubmission(onSubmissionChange)).toMatchObject({ result: FAILED });
    await userEvent.click(python());
    expect(lastSubmission(onSubmissionChange)).toBeNull();
    await runTests();
    expect(lastSubmission(onSubmissionChange)).toMatchObject({ result: PASSED });
    await userEvent.click(screen.getByRole('radio', { name: 'TypeScript' }));
    expect(lastSubmission(onSubmissionChange)).toMatchObject({ result: FAILED });
  });

  it('remembers the choice for the next twin step, and a step without that language ignores it', async () => {
    const first = renderTwin();
    await userEvent.click(python());
    first.unmount();

    renderTwin({ ...TWIN, id: 'write-sum' });
    expect(python()).toBeChecked();
    expect(screen.getByLabelText('Your code')).toHaveValue(TWIN.twin?.starterCode);
    cleanup();

    renderTwin({ ...TWIN, twin: { ...(TWIN.twin ?? STEP), language: 'js' } as never });
    expect(screen.getByRole('radio', { name: 'TypeScript' })).toBeChecked();
  });

  it('shows the solution of the language on screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          solutions: { 'write-add': 'TS SOLVED', 'write-add:twin': 'PY SOLVED' },
        }),
      })),
    );
    renderTwin(TWIN, { solutionsUrl: '/s.json' });
    for (const n of [1, 2, 3])
      await userEvent.click(screen.getByRole('button', { name: `Hint ${n} of 3` }));
    await userEvent.click(screen.getByRole('button', { name: 'Show solution' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByLabelText('Reference solution')).toHaveValue('TS SOLVED');
    await userEvent.click(python());
    expect(screen.getByLabelText('Reference solution')).toHaveValue('PY SOLVED');
  });
});
