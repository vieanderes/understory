import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CompiledCodeChallengeStep } from '@/core/content/compiled';
import type { RunResult } from '@/core/ports/code-runner';
import { withTypeCheck } from '@/core/typecheck/verdict';
import type { LazyCodeEditorProps } from '@/features/editor/LazyCodeEditor';
import type { Submission } from '@/features/lesson-player/contract';
import { CodeChallengeStep } from '@/features/lesson-player/steps/CodeChallengeStep';

const seen: { typecheck?: LazyCodeEditorProps['typecheck'] }[] = [];

// A plain field for the editor, whose handle reports one type error on any code with
// "string" in it. The checker itself has its own tests (tests/unit/ui/editor/typecheck.test.tsx).
vi.mock('@/features/editor/LazyCodeEditor', () => ({
  LazyCodeEditor: ({ value, onChange, ariaLabel, typecheck }: LazyCodeEditorProps) => {
    seen.push({ typecheck });
    if (typecheck?.handleRef) {
      typecheck.handleRef.current = {
        begin: (code) => (result) =>
          Promise.resolve(
            withTypeCheck(result, {
              status: 'checked',
              diagnostics: code.includes('string')
                ? [{ from: 0, to: 1, line: 1, column: 1, code: 2322, message: 'Not a number.' }]
                : [],
            }),
          ),
      };
    }
    return (
      <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange?.(e.target.value)} />
    );
  },
}));

const rich = (text: string) => ({ md: text, html: `<p>${text}</p>` });

const STEP: CompiledCodeChallengeStep = {
  type: 'code-challenge',
  id: 'write-add',
  concept: 'ts.types',
  difficulty: 2,
  prompt: rich('Fix add.'),
  language: 'ts',
  starterCode: 'export function add(a: number, b: number): string {\n  return a + b;\n}\n',
  starterHtml: '<pre><code>starter</code></pre>',
  testsCode: "test('adds', () => { expect(add(1, 2)).toBe(3); });",
  typecheck: true,
  hints: [rich('One'), rich('Two'), rich('Three')],
};

const PASSED: RunResult = { status: 'passed', tests: [{ name: 'adds', passed: true }], logs: [] };

function setup(step: CompiledCodeChallengeStep) {
  const runner = { run: vi.fn(() => Promise.resolve(PASSED)), dispose: vi.fn() };
  const onSubmissionChange = vi.fn<(submission: Submission | null) => void>();
  render(
    <CodeChallengeStep
      step={step}
      phase="answering"
      reveal={false}
      seed={1}
      lessonId="ts.test"
      createRunner={() => runner}
      onSubmissionChange={onSubmissionChange}
      requestCheck={vi.fn()}
    />,
  );
  return { onSubmissionChange };
}

describe('a type-checked code challenge', () => {
  it('fails a run whose tests pass while the code has type errors', async () => {
    const { onSubmissionChange } = setup(STEP);
    await userEvent.click(screen.getByRole('button', { name: 'Run tests' }));

    const results = screen.getByRole('region', { name: 'Test results' });
    expect(await within(results).findByText('1 of 2 pass')).toBeVisible();
    const rows = within(results).getAllByTestId('test-row');
    expect(rows[0]).toHaveAttribute('data-passed', 'false');
    expect(rows[0]).toHaveTextContent('Type errors');
    expect(rows[0]).toHaveTextContent('Line 1: Not a number.');
    const submission = onSubmissionChange.mock.calls.at(-1)?.[0];
    expect(submission).toMatchObject({ type: 'code-challenge', result: { status: 'failed' } });
  });

  it('passes once the types are right, with the check shown', async () => {
    setup(STEP);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Your code' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Your code' }), 'fixed');
    await userEvent.click(screen.getByRole('button', { name: 'Run tests' }));
    const results = screen.getByRole('region', { name: 'Test results' });
    expect(await within(results).findByText('All tests pass')).toBeVisible();
    expect(within(results).getAllByTestId('test-row')[0]).toHaveTextContent('No type errors');
  });

  it('gives the editor nothing to check on a step without typecheck', () => {
    seen.length = 0;
    setup({ ...STEP, typecheck: undefined });
    expect(seen.every((props) => props.typecheck === undefined)).toBe(true);
  });
});
