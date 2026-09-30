import { EditorSelection, Prec, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { bracketInsertion } from './close-brackets';

/*
 * iOS "Smart Punctuation" turns a typed quote into a curly one and two hyphens into a
 * dash, in any editable element, whatever `autocorrect` says. Curly quotes are a
 * syntax error a beginner cannot see, so what the keyboard bends is straightened as
 * it arrives. Code never wants the typographic form, so this runs everywhere.
 */

const STRAIGHT: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '–': '-',
  '—': '--',
  '…': '...',
};
const BENT = /[‘-‟–—…]/g;

export function straightenPunctuation(text: string): string {
  return text.replace(BENT, (char) => STRAIGHT[char] ?? char);
}

/**
 * What an input handler does with typed text. True when the text was bent and has
 * been dispatched straight; false leaves it to the handlers after this one.
 */
export function handleBentInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (view.state.readOnly) return false;
  const straight = straightenPunctuation(text);
  if (straight === text) return false;
  const main = view.state.selection.main;
  // A single quote gets the same pairing it would have had typed straight.
  const paired =
    straight.length === 1 && from === main.from && to === main.to && !view.composing
      ? bracketInsertion(view.state, straight)
      : null;
  view.dispatch(
    paired ?? {
      changes: { from, to, insert: straight },
      selection: EditorSelection.cursor(from + straight.length),
      scrollIntoView: true,
      userEvent: 'input.type',
    },
  );
  return true;
}

/** Before every other input handler, so bracket closing sees the straight quote. */
export function straightPunctuation(): Extension {
  return Prec.highest(EditorView.inputHandler.of(handleBentInput));
}
