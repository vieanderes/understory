import { forEachDiagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '@/core/ports/code-runner';
import CodeEditor from '@/features/editor/CodeEditor';
import type { TypecheckHandle } from '@/features/editor/typecheck-types';

// The real compiler, in Node, behind the worker's interface: the editor cannot tell.
vi.mock('@/adapters/typecheck/worker-checker', async () => {
  const { createNodeTypeChecker } = await import('@/adapters/typecheck/node');
  class WorkerTypeChecker {
    private readonly inner = createNodeTypeChecker();
    check = (request: { code: string; tests: string }) => this.inner.check(request);
    dispose() {}
  }
  return { WorkerTypeChecker };
});

const TESTS =
  "import { total } from './solution';\ntest('t', () => expect(total([2, 3])).toBe(5));\n";
const BROKEN = 'export function total(prices: number[]): number {\n  return prices.join("+");\n}\n';
const FIXED =
  'export function total(prices: number[]): number {\n  return prices.reduce((a, b) => a + b, 0);\n}\n';

function viewOf(container: HTMLElement): EditorView {
  const dom = container.querySelector<HTMLElement>('.cm-editor');
  const view = dom ? EditorView.findFromDOM(dom) : null;
  if (!view) throw new Error('no editor');
  return view;
}

function replaceDoc(view: EditorView, text: string) {
  act(() => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  });
}

const statusOf = () => screen.getByTestId('type-check');

describe('live type checking in the editor', () => {
  it('underlines an error, lists it with its line, and clears when fixed', async () => {
    const { container } = render(
      <CodeEditor
        value={BROKEN}
        language="ts"
        ariaLabel="Your code"
        typecheck={{ tests: TESTS }}
      />,
    );
    await waitFor(() => expect(statusOf()).toHaveAttribute('data-count', '1'), { timeout: 5000 });

    expect(screen.getByRole('status')).toHaveTextContent('1 type error');
    const message = "Type 'string' is not assignable to type 'number'.";
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Line 2' })).toBeVisible();

    const view = viewOf(container);
    const found: { from: number; message: string }[] = [];
    forEachDiagnostic(view.state, (d, from) => found.push({ from, message: d.message }));
    expect(found).toEqual([{ from: BROKEN.indexOf('return'), message }]);
    expect(container.querySelector('.cm-lintRange-error')).toHaveTextContent('return');

    replaceDoc(view, FIXED);
    await waitFor(() => expect(statusOf()).toHaveAttribute('data-count', '0'), { timeout: 5000 });
    expect(screen.getByRole('status')).toHaveTextContent('No type errors');
    expect(screen.queryByTestId('type-errors')).toBeNull();
  });

  it('puts the caret on the error when its line is chosen', async () => {
    const { container } = render(
      <CodeEditor
        value={BROKEN}
        language="ts"
        ariaLabel="Your code"
        typecheck={{ tests: TESTS }}
      />,
    );
    const button = await screen.findByRole('button', { name: 'Line 2' }, { timeout: 5000 });
    await userEvent.click(button);
    const view = viewOf(container);
    expect(view.state.selection.main.head).toBe(BROKEN.indexOf('return'));
    expect(view.hasFocus).toBe(true);
  });

  it('keeps the line numbers true while the learner types above the error', async () => {
    const { container } = render(
      <CodeEditor
        value={BROKEN}
        language="ts"
        ariaLabel="Your code"
        typecheck={{ tests: TESTS }}
      />,
    );
    await screen.findByRole('button', { name: 'Line 2' }, { timeout: 5000 });
    const view = viewOf(container);
    act(() => {
      view.dispatch({ changes: { from: 0, insert: '// a note\n' } });
    });
    expect(screen.getByRole('button', { name: 'Line 3' })).toBeVisible();
  });

  it('adds the verdict to a run through the handle', async () => {
    const handle = createRef<TypecheckHandle | null>() as { current: TypecheckHandle | null };
    render(
      <CodeEditor
        value={BROKEN}
        language="ts"
        ariaLabel="Your code"
        typecheck={{ tests: TESTS, handleRef: handle }}
      />,
    );
    await waitFor(() => expect(handle.current).not.toBeNull(), { timeout: 5000 });
    const passed: RunResult = { status: 'passed', tests: [{ name: 't', passed: true }], logs: [] };
    const result = await handle.current?.begin(BROKEN)(passed);
    expect(result?.status).toBe('failed');
    expect(result?.tests[0]).toMatchObject({ name: 'Type errors', passed: false });
    const clean = await handle.current?.begin(FIXED)(passed);
    expect(clean?.status).toBe('passed');
    expect(clean?.tests[0]).toEqual({ name: 'No type errors', passed: true });
  });

  it('shows nothing of the checker for a step that does not check types', () => {
    render(<CodeEditor value={BROKEN} language="ts" ariaLabel="Your code" />);
    expect(screen.queryByTestId('type-check')).toBeNull();
  });
});
