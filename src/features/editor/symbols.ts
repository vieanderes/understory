import { indentLess, indentMore, redo, undo } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import { bracketInsertion } from './close-brackets';
import type { EditorLanguage } from './extensions';

export type SymbolAction = 'indent' | 'outdent' | 'undo' | 'redo';

type Plain =
  | { kind: 'text'; text: string; label: string }
  | { kind: 'action'; action: SymbolAction; label: string };

/** A key, and what a long press on it types instead. */
export type SymbolKey = Plain & { alt?: Plain };

const LABELS: Record<string, string> = {
  '(': 'Round brackets',
  ')': 'Closing round bracket',
  '{': 'Braces',
  '}': 'Closing brace',
  '[': 'Square brackets',
  ']': 'Closing square bracket',
  ';': 'Semicolon',
  ':': 'Colon',
  '=': 'Equals',
  '.': 'Full stop',
  ',': 'Comma',
  "'": 'Single quotes',
  '"': 'Double quotes',
  '`': 'Backticks',
  '=>': 'Arrow',
  '<': 'Less than',
  '>': 'Greater than',
  '/': 'Slash',
  '!': 'Not',
  '&': 'Ampersand',
  '|': 'Pipe',
  '+': 'Plus',
  '-': 'Minus',
  '*': 'Asterisk',
  _: 'Underscore',
  '#': 'Hash',
  '%': 'Percent',
};

const ACTION_LABELS: Record<SymbolAction, string> = {
  indent: 'Indent',
  outdent: 'Outdent',
  undo: 'Undo',
  redo: 'Redo',
};

/*
 * A long press types the partner that shares the key: the square bracket with the round
 * one, the other quote, the comma with the full stop, the colon with the semicolon, the
 * underscore with the minus. It is a shortcut for what is also a key further along the
 * row, never the only way to a character.
 */
const ALTERNATES: Record<string, string> = {
  '(': '[',
  ')': ']',
  "'": '"',
  '.': ',',
  ';': ':',
  '-': '_',
};

function plain(glyph: string): Plain {
  if (glyph.startsWith('@')) {
    const action = glyph.slice(1) as SymbolAction;
    return { kind: 'action', action, label: ACTION_LABELS[action] };
  }
  return { kind: 'text', text: glyph, label: LABELS[glyph] ?? glyph };
}

function key(glyph: string): SymbolKey {
  const alt = ALTERNATES[glyph];
  return alt === undefined ? plain(glyph) : { ...plain(glyph), alt: plain(alt) };
}

/*
 * The order of each row, most typed first. On a 390 px phone the first seven keys show
 * without a scroll, so those are what the language asks for most: brackets and the
 * semicolon in JavaScript, the colon in TypeScript types, the colon, quotes and the
 * underscore of snake_case in Python, tags in HTML, rules in CSS, the star and the quotes
 * of a query in SQL. Indent, Outdent and Redo come after the symbols: auto-indent and
 * Backspace do most of that work, and Undo is pinned. `@` marks an action.
 */
const ORDER: Record<EditorLanguage, string> = {
  js: '( ) { } ; = . \' , [ ] => " ` < > ! & | + - * / : _ # @indent @outdent @redo',
  ts: '( ) { } : ; = . \' , < > [ ] => " ` ! & | + - * / _ # @indent @outdent @redo',
  tsx: '< > / { } ( ) = " \' . , ; : [ ] => ` ! & | + - * _ # @indent @outdent @redo',
  python: ': ( ) \' = _ [ ] . , " # @indent @outdent { } + - * / < > ! % & | ; @redo',
  html: '< > / = " \' ! - . # : ; { } ( ) [ ] , & + * _ | @indent @outdent @redo',
  css: '{ } : ; . # - ( ) % , " \' > + * [ ] = / ! < & _ | @indent @outdent @redo',
  sql: '* ( ) \' , ; = < > . " - _ % ! | + / : [ ] @indent @outdent @redo',
};

const rows = new Map<EditorLanguage, readonly SymbolKey[]>();

/** The row of keys for a language, built once. */
export function symbolKeysFor(language: EditorLanguage): readonly SymbolKey[] {
  let row = rows.get(language);
  if (!row) {
    row = ORDER[language].split(' ').map(key);
    rows.set(language, row);
  }
  return row;
}

/**
 * Always under the thumb, at the end of the row: a phone keyboard has no shortcut for
 * undo, and it is wanted far more often than redo, which is its long press.
 */
export const PINNED_KEYS: readonly SymbolKey[] = [{ ...plain('@undo'), alt: plain('@redo') }];

/**
 * Types `value` at the cursor as the keyboard would. An opening bracket or a quote
 * arrives with its partner and the cursor lands between the two.
 */
export function insertSymbol(view: EditorView, value: string): void {
  if (view.state.readOnly) return;
  const paired = bracketInsertion(view.state, value, { always: true });
  view.dispatch(
    paired ?? {
      ...view.state.replaceSelection(value),
      scrollIntoView: true,
      userEvent: 'input.type',
    },
  );
}

export function runSymbolAction(view: EditorView, action: SymbolAction): void {
  if (view.state.readOnly) return;
  const command = { indent: indentMore, outdent: indentLess, undo, redo }[action];
  command(view);
}

/** A tap, or with `alternate` a long press, which types the key's partner. */
export function pressSymbolKey(view: EditorView, key: SymbolKey, alternate = false): void {
  const pressed: Plain = alternate && key.alt ? key.alt : key;
  if (pressed.kind === 'text') insertSymbol(view, pressed.text);
  else runSymbolAction(view, pressed.action);
}
