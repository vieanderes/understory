import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import {
  moveCaret,
  selectLineAtCaret,
  selectWordAtCaret,
  trackpadSteps,
} from '@/features/editor/cursor';

let view: EditorView | undefined;

function editor(doc: string, anchor: number, head = anchor): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, selection: EditorSelection.single(anchor, head) }),
  });
  return view;
}

const range = (v: EditorView) => [v.state.selection.main.from, v.state.selection.main.to];

afterEach(() => {
  view?.destroy();
  view = undefined;
});

describe('trackpadSteps', () => {
  it('turns a drag into whole steps not yet applied', () => {
    expect(trackpadSteps(11, 12, 0)).toBe(0);
    expect(trackpadSteps(12, 12, 0)).toBe(1);
    expect(trackpadSteps(30, 12, 1)).toBe(1);
    expect(trackpadSteps(-25, 12, 0)).toBe(-2);
    expect(trackpadSteps(-25, 12, -2)).toBe(0);
    // Dragging back undoes steps.
    expect(trackpadSteps(5, 12, 2)).toBe(-2);
  });
});

describe('moveCaret', () => {
  // Up and down need layout, which jsdom has not: the phone e2e covers them.
  it('moves by characters, across a line break', () => {
    const v = editor('ab\ncd', 1);
    moveCaret(v, 'right');
    expect(range(v)).toEqual([2, 2]);
    moveCaret(v, 'right');
    expect(range(v)).toEqual([3, 3]);
    moveCaret(v, 'left');
    moveCaret(v, 'left');
    moveCaret(v, 'left');
    expect(range(v)).toEqual([0, 0]);
  });
});

describe('selecting', () => {
  it('selects the word at the caret, or reports there is none', () => {
    const v = editor('let total = 1;', 6);
    expect(selectWordAtCaret(v)).toBe(true);
    expect(range(v)).toEqual([4, 9]);
    const blank = editor('a  b', 2);
    expect(selectWordAtCaret(blank)).toBe(false);
  });

  it('selects the whole line', () => {
    const v = editor('one\ntwo\n', 5);
    expect(selectLineAtCaret(v)).toBe(true);
    expect(v.state.sliceDoc(...(range(v) as [number, number]))).toBe('two\n');
  });
});
