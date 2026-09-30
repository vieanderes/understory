import {
  EditorSelection,
  Prec,
  type EditorState,
  type Extension,
  type TransactionSpec,
} from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

/*
 * Bracket closing, written here because CodeMirror keeps its own in
 * @codemirror/autocomplete, and this editor must not carry an autocompletion package as
 * a dependency: "Unplugged" is the point of the step. Closing a bracket is typing help,
 * not an answer, so it stays. The symbol bar uses the same functions.
 */

const CLOSER: Readonly<Record<string, string>> = {
  '(': ')',
  '[': ']',
  '{': '}',
  "'": "'",
  '"': '"',
  '`': '`',
};
const QUOTES = new Set(["'", '"', '`']);
const CLOSERS = new Set([')', ']', '}']);
/** An opener is paired only in front of these, so typing `(` before a word leaves it alone. */
const CLOSE_BEFORE = /^[\s)\]}:;>,.]?$/;
const WORD = /[\w$]/;

export function isPairOpener(text: string): boolean {
  return text in CLOSER;
}

interface Options {
  /** The symbol bar always pairs: its key says `{` and a learner expects `{}`. */
  always?: boolean;
}

/**
 * What typing `text` should do when brackets are involved, or null when it is ordinary
 * typing. Pairs an opener, wraps a selection, and steps over a closer that is already
 * there instead of doubling it.
 */
export function bracketInsertion(
  state: EditorState,
  text: string,
  options: Options = {},
): TransactionSpec | null {
  const closer = CLOSER[text];
  const quote = QUOTES.has(text);
  if (closer === undefined && !CLOSERS.has(text)) return null;

  let handled = false;
  const change = state.changeByRange((range) => {
    const next = state.sliceDoc(range.to, range.to + 1);
    const before = state.sliceDoc(range.from - 1, range.from);

    if (range.empty && next === text && (quote || CLOSERS.has(text))) {
      handled = true;
      return { range: EditorSelection.cursor(range.from + 1) };
    }
    if (closer === undefined) return { range };

    if (!range.empty) {
      handled = true;
      return {
        changes: [
          { from: range.from, insert: text },
          { from: range.to, insert: closer },
        ],
        range: EditorSelection.range(range.anchor + 1, range.head + 1),
      };
    }

    // A quote after a word is an apostrophe or the end of a string typed by hand.
    const pairs = quote
      ? !WORD.test(before) && before !== text && before !== '\\'
      : CLOSE_BEFORE.test(next);
    if (!pairs && !options.always) return { range };
    handled = true;
    return {
      changes: { from: range.from, insert: text + closer },
      range: EditorSelection.cursor(range.from + 1),
    };
  });

  if (!handled) return null;
  return { ...change, scrollIntoView: true, userEvent: 'input.type' };
}

/** Backspace between an empty pair removes both halves. */
export function pairDeletion(state: EditorState): TransactionSpec | null {
  let handled = true;
  const change = state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - 1, range.from);
    const after = state.sliceDoc(range.from, range.from + 1);
    if (range.empty && before !== '' && CLOSER[before] === after) {
      return {
        changes: { from: range.from - 1, to: range.from + 1 },
        range: EditorSelection.cursor(range.from - 1),
      };
    }
    handled = false;
    return { range };
  });
  if (!handled) return null;
  return { ...change, scrollIntoView: true, userEvent: 'delete.backward' };
}

export function closeBrackets(): Extension {
  return [
    EditorView.inputHandler.of((view, from, to, text) => {
      if (view.composing || view.state.readOnly || text.length !== 1) return false;
      const main = view.state.selection.main;
      if (from !== main.from || to !== main.to) return false;
      const spec = bracketInsertion(view.state, text);
      if (!spec) return false;
      view.dispatch(spec);
      return true;
    }),
    Prec.high(
      keymap.of([
        {
          key: 'Backspace',
          run: (view) => {
            if (view.state.readOnly) return false;
            const spec = pairDeletion(view.state);
            if (!spec) return false;
            view.dispatch(spec);
            return true;
          },
        },
      ]),
    ),
  ];
}
