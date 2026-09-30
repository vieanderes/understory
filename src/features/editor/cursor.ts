import {
  cursorCharLeft,
  cursorCharRight,
  cursorLineDown,
  cursorLineUp,
  selectLine,
} from '@codemirror/commands';
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/*
 * Caret control for a touch screen. iOS can drag the caret, and the space bar turns the
 * keyboard into a trackpad, but neither lands reliably between two brackets and few
 * people know the second. The cursor keys in the suggestion row do both jobs: a tap
 * moves one step, and a drag across them moves the caret like a trackpad, the gesture
 * Pythonista puts on its key row (docs/MOBILE-EDITING.md).
 */

export type CaretDirection = 'left' | 'right' | 'up' | 'down';

const COMMAND = {
  left: cursorCharLeft,
  right: cursorCharRight,
  up: cursorLineUp,
  down: cursorLineDown,
} as const;

export function moveCaret(view: EditorView, direction: CaretDirection): void {
  COMMAND[direction](view);
}

/**
 * How many steps a drag of `delta` pixels still owes, given `applied` steps already made.
 * Negative moves back. Dragging back past a step takes it back, as a trackpad would.
 */
export function trackpadSteps(delta: number, stepPx: number, applied: number): number {
  return Math.trunc(delta / stepPx) - applied;
}

/** Long-press selection on iOS is slow in code. These are one tap. */
export function selectWordAtCaret(view: EditorView): boolean {
  const word = view.state.wordAt(view.state.selection.main.head);
  if (!word) return false;
  view.dispatch({ selection: EditorSelection.range(word.from, word.to), userEvent: 'select' });
  return true;
}

export function selectLineAtCaret(view: EditorView): boolean {
  return selectLine(view);
}
