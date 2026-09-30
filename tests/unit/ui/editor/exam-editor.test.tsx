import { completionStatus, currentCompletions } from '@codemirror/autocomplete';
import { getIndentUnit } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeEditor from '@/features/editor/CodeEditor';

/** A desk: no `(pointer: coarse)`, no phone width. */
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => vi.unstubAllGlobals());

function editorView(): EditorView {
  const dom = screen.getByTestId('code-editor').querySelector<HTMLElement>('.cm-editor');
  const view = dom && EditorView.findFromDOM(dom);
  if (!view) throw new Error('No editor view');
  return view;
}

function textbox(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Solution' });
}

/** Types as the keyboard does, so completion sees `input.type` events. */
function type(view: EditorView, text: string) {
  act(() => {
    view.dispatch({
      changes: { from: view.state.selection.main.head, insert: text },
      selection: { anchor: view.state.selection.main.head + text.length },
      userEvent: 'input.type',
    });
  });
}

const CODE = 'function solution(values) {\n  return values;\n}\n';

/** Waits for the exam chunk: its fold gutter is the sign it has been swapped in. */
async function examLoaded() {
  await waitFor(() =>
    expect(screen.getByTestId('code-editor').querySelector('.cm-foldGutter')).not.toBeNull(),
  );
}

describe('CodeEditor, exam profile', () => {
  it('has line numbers, a fold gutter and four-space indents', async () => {
    render(<CodeEditor value={CODE} language="ts" ariaLabel="Solution" assist="exam" />);
    await examLoaded();
    const editor = screen.getByTestId('code-editor');
    expect(editor.querySelector('.cm-lineNumbers')).not.toBeNull();
    expect(getIndentUnit(editorView().state)).toBe(4);
    expect(editorView().state.tabSize).toBe(4);
  });

  it('opens find and replace on Mod-F, in the app voice', async () => {
    render(<CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" />);
    await examLoaded();
    fireEvent.keyDown(textbox(), { key: 'f', code: 'KeyF', ctrlKey: true });
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Find' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Replace with' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Match case' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('opens the completion list on Ctrl-Space, and never while typing', async () => {
    render(<CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" />);
    await examLoaded();
    const view = editorView();
    act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));

    type(view, 'val');
    // Give an eager completion source every chance to open.
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(completionStatus(view.state)).toBeNull();

    fireEvent.keyDown(textbox(), { key: ' ', code: 'Space', ctrlKey: true });
    await waitFor(() => expect(completionStatus(view.state)).toBe('active'));
    const labels = currentCompletions(view.state).map((option) => option.label);
    // A word from the file, and nothing that is not in the file or the language.
    expect(labels).toContain('values');
  });

  it('offers the language keywords too', async () => {
    render(<CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" />);
    await examLoaded();
    const view = editorView();
    act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
    type(view, 'con');
    fireEvent.keyDown(textbox(), { key: ' ', code: 'Space', ctrlKey: true });
    await waitFor(() =>
      expect(currentCompletions(view.state).map((option) => option.label)).toContain('const'),
    );
  });

  it('runs on F9 and saves on Mod-S', () => {
    const onRun = vi.fn();
    const onSave = vi.fn();
    render(
      <CodeEditor
        value={CODE}
        language="js"
        ariaLabel="Solution"
        assist="exam"
        onRun={onRun}
        onSave={onSave}
      />,
    );
    fireEvent.keyDown(textbox(), { key: 'F9', code: 'F9' });
    expect(onRun).toHaveBeenCalledOnce();

    const save = fireEvent.keyDown(textbox(), { key: 's', code: 'KeyS', ctrlKey: true });
    expect(onSave).toHaveBeenCalledOnce();
    // The browser's own Save page dialog must not open.
    expect(save).toBe(false);
  });

  it('leaves the editor on Ctrl-Shift-M, for the next control or the handler', () => {
    const { rerender } = render(
      <>
        <CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" />
        <button type="button">Run code</button>
      </>,
    );
    textbox().focus();
    fireEvent.keyDown(textbox(), {
      key: 'M',
      code: 'KeyM',
      keyCode: 77,
      ctrlKey: true,
      shiftKey: true,
    });
    expect(screen.getByRole('button', { name: 'Run code' })).toHaveFocus();

    const onLeave = vi.fn();
    rerender(
      <>
        <CodeEditor
          value={CODE}
          language="js"
          ariaLabel="Solution"
          assist="exam"
          onLeave={onLeave}
        />
        <button type="button">Run code</button>
      </>,
    );
    textbox().focus();
    fireEvent.keyDown(textbox(), {
      key: 'M',
      code: 'KeyM',
      keyCode: 77,
      ctrlKey: true,
      shiftKey: true,
    });
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('loads Vim when turned on, and drops it when turned off, in the same editor', async () => {
    const { rerender } = render(
      <CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" />,
    );
    const view = editorView();
    expect(view.scrollDOM).not.toHaveClass('cm-vimMode');

    rerender(<CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" vim />);
    await waitFor(() => expect(view.scrollDOM).toHaveClass('cm-vimMode'));
    expect(editorView()).toBe(view);

    rerender(<CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" />);
    await waitFor(() => expect(view.scrollDOM).not.toHaveClass('cm-vimMode'));
  });

  it('sets code at the section size in the large accessibility mode', () => {
    const { rerender } = render(
      <CodeEditor value={CODE} language="js" ariaLabel="Solution" assist="exam" />,
    );
    const view = editorView();
    expect(view.dom).not.toHaveClass('cm-largeText');
    rerender(
      <CodeEditor
        value={CODE}
        language="js"
        ariaLabel="Solution"
        assist="exam"
        fontScale="large"
      />,
    );
    expect(view.dom).toHaveClass('cm-largeText');
  });
});

describe('CodeEditor, default profile', () => {
  it('is unchanged: no fold gutter, no completion, no F9, two-space indents', async () => {
    const onRun = vi.fn();
    render(<CodeEditor value={CODE} language="js" ariaLabel="Solution" onRun={onRun} />);
    const view = editorView();
    const editor = screen.getByTestId('code-editor');
    expect(editor.querySelector('.cm-lineNumbers')).not.toBeNull();
    expect(getIndentUnit(view.state)).toBe(2);

    fireEvent.keyDown(textbox(), { key: 'F9', code: 'F9' });
    expect(onRun).not.toHaveBeenCalled();

    act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
    type(view, 'val');
    fireEvent.keyDown(textbox(), { key: ' ', code: 'Space', ctrlKey: true });
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(completionStatus(view.state)).toBeNull();
    expect(editor.querySelector('.cm-foldGutter')).toBeNull();

    // Mod-S stays the browser's when nothing handles it.
    expect(fireEvent.keyDown(textbox(), { key: 's', code: 'KeyS', ctrlKey: true })).toBe(true);
  });
});
