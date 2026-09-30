import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasFields } from '@/features/editor/snippet';
import { suggest } from '@/features/editor/suggestions';
import { SymbolBar } from '@/features/editor/SymbolBar';
import { snippetFields } from '@/features/editor/snippet';

let view: EditorView | undefined;

afterEach(() => {
  view?.destroy();
  view = undefined;
  vi.unstubAllGlobals();
});

/** A visual viewport 300 px shorter than the window: the keyboard is up. */
function keyboardUp() {
  const viewport = Object.assign(new EventTarget(), {
    offsetTop: 0,
    offsetLeft: 0,
    width: 390,
    height: 544,
    scale: 1,
  });
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
}

function tap(element: HTMLElement) {
  fireEvent.pointerDown(element);
  fireEvent.pointerUp(element);
}

function setup(doc = '') {
  view = new EditorView({ parent: document.body, state: EditorState.create({ doc }) });
  render(<SymbolBar viewRef={{ current: view }} editorFocused={false} />);
  return view;
}

describe('SymbolBar', () => {
  it('is a labelled toolbar of 30 keys, brackets first and Undo pinned last', () => {
    setup();
    expect(screen.getByRole('toolbar', { name: 'Symbols' })).toBeInTheDocument();
    const names = screen.getAllByRole('button').map((key) => key.getAttribute('aria-label'));
    expect(names).toHaveLength(30);
    expect(names.slice(0, 4)).toEqual([
      'Round brackets',
      'Closing round bracket',
      'Braces',
      'Closing brace',
    ]);
    expect(names.at(-1)).toBe('Undo');
    expect(names).not.toContain('Full screen');
  });

  it('orders the keys for the language: the colon first in Python', () => {
    view = new EditorView({ parent: document.body, state: EditorState.create({ doc: '' }) });
    render(<SymbolBar viewRef={{ current: view }} editorFocused={false} language="python" />);
    expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-label', 'Colon');
  });

  it('types the partner on a long press, and nothing more when the finger lifts', () => {
    // Only the timers: a faked animation frame would have CodeMirror measure in jsdom.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const v = setup();
      const round = screen.getByRole('button', { name: 'Round brackets' });
      expect(round).toHaveTextContent('([');
      fireEvent.pointerDown(round);
      vi.advanceTimersByTime(450);
      fireEvent.pointerUp(round);
      expect(v.state.doc.toString()).toBe('[]');
      // A short tap is the key itself.
      tap(round);
      expect(v.state.doc.toString()).toBe('[()]');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays in the page, one row, until the editor has focus and the keyboard is up', () => {
    setup();
    expect(screen.getByTestId('symbol-bar').firstElementChild).toHaveAttribute(
      'data-docked',
      'false',
    );
    expect(screen.queryByRole('toolbar', { name: 'Suggestions' })).toBeNull();
  });

  it('rides on the keyboard with a second row, while the editor has focus', () => {
    keyboardUp();
    view = new EditorView({ parent: document.body, state: EditorState.create({ doc: '' }) });
    const onRun = vi.fn();
    render(
      <SymbolBar viewRef={{ current: view }} editorFocused onRun={onRun} runLabel="Run tests" />,
    );
    expect(screen.getByTestId('symbol-bar').firstElementChild).toHaveAttribute(
      'data-docked',
      'true',
    );
    const row = screen.getByRole('toolbar', { name: 'Suggestions' });
    // Nothing typed yet: selection tools stand in for suggestions.
    expect(screen.getByRole('button', { name: 'Select word' })).toBeInTheDocument();
    tap(screen.getByRole('button', { name: 'Run tests' }));
    expect(onRun).toHaveBeenCalledOnce();
    expect(row).toContainElement(screen.getByRole('button', { name: 'Move left' }));
  });

  it('inserts a pair through the view when the press lifts, and puts the cursor between', () => {
    const v = setup();
    const key = screen.getByRole('button', { name: 'Braces' });
    fireEvent.pointerDown(key);
    fireEvent.pointerUp(key);
    // Chromium follows a press with a click. It must not type a second pair.
    fireEvent.click(key, { detail: 1 });
    expect(v.state.doc.toString()).toBe('{}');
    expect(v.state.selection.main.head).toBe(1);
  });

  it('cancels the press, so the editor keeps focus and the keyboard stays up', () => {
    setup();
    const key = screen.getByRole('button', { name: 'Semicolon' });
    // fireEvent returns false when preventDefault was called.
    expect(fireEvent.pointerDown(key)).toBe(false);
    expect(fireEvent.mouseDown(key)).toBe(false);
  });

  it('types nothing when the press turns into a scroll of the row', () => {
    const v = setup();
    const key = screen.getByRole('button', { name: 'Semicolon' });
    fireEvent.pointerDown(key);
    fireEvent.pointerCancel(key);
    fireEvent.pointerUp(key);
    expect(v.state.doc.toString()).toBe('');
  });

  it('types nothing when the press slides onto another key', () => {
    const v = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Semicolon' }));
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Equals' }));
    expect(v.state.doc.toString()).toBe('');
  });

  it('works from a keyboard, where a click is the only event', () => {
    const v = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Arrow' }), { detail: 0 });
    expect(v.state.doc.toString()).toBe('=>');
  });
});

describe('SymbolBar, second row', () => {
  function expanded(doc: string, language: 'js' | 'python' = 'js') {
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [snippetFields()],
      }),
    });
    const v = view;
    const rerenderWith = () => (
      <SymbolBar
        viewRef={{ current: v }}
        editorFocused
        expanded
        suggestions={suggest(v.state, { language, mode: 'unplugged' })}
        fieldsActive={hasFields(v.state)}
      />
    );
    const utils = render(rerenderWith());
    return { v, refresh: () => utils.rerender(rerenderWith()) };
  }

  it('inserts a block from a keyword chip, then offers Next to its next gap', () => {
    const { v, refresh } = expanded('i');
    tap(screen.getByRole('button', { name: 'if () {}' }));
    expect(v.state.doc.toString()).toBe('if () {\n  \n}');
    expect(v.state.selection.main.head).toBe(4);
    refresh();
    tap(screen.getByRole('button', { name: 'Next gap' }));
    expect(v.state.selection.main.head).toBe(10);
  });

  it('completes a name from the file', () => {
    const { v } = expanded('let total = 0;\nto');
    tap(screen.getByRole('button', { name: 'total' }));
    expect(v.state.doc.toString()).toBe('let total = 0;\ntotal');
  });

  it('ignores a chip made for a caret that has since moved', () => {
    const { v } = expanded('let total = 0;\nto');
    v.dispatch({ selection: { anchor: 0 } });
    tap(screen.getByRole('button', { name: 'total' }));
    expect(v.state.doc.toString()).toBe('let total = 0;\nto');
  });

  it('moves the caret with a tap on a cursor key, and selects the word', () => {
    const { v } = expanded('let x');
    // Tap once: pointer down and up without a drag.
    tap(screen.getByRole('button', { name: 'Move left' }));
    expect(v.state.selection.main.head).toBe(4);
    fireEvent.click(screen.getByRole('button', { name: 'Move right' }), { detail: 0 });
    expect(v.state.selection.main.head).toBe(5);
  });

  it('moves the caret by a character for every 12 px dragged across a cursor key', () => {
    const { v } = expanded('abcdef');
    const key = screen.getByRole('button', { name: 'Move right' });
    fireEvent.pointerDown(key, { clientX: 100, clientY: 10 });
    fireEvent.pointerMove(key, { clientX: 64, clientY: 10 });
    expect(v.state.selection.main.head).toBe(3);
    fireEvent.pointerUp(key, { clientX: 64, clientY: 10 });
    // The drag was the whole gesture: lifting the finger does not add a step.
    expect(v.state.selection.main.head).toBe(3);
  });

  it('has no Run key in full screen, where the header has one', () => {
    expanded('');
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Full screen' })).toBeNull();
  });
});
