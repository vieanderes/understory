import { history } from '@codemirror/commands';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { bracketInsertion, pairDeletion } from '@/features/editor/close-brackets';
import type { EditorLanguage } from '@/features/editor/extensions';
import {
  insertSymbol,
  PINNED_KEYS,
  pressSymbolKey,
  runSymbolAction,
  symbolKeysFor,
  type SymbolKey,
} from '@/features/editor/symbols';

let view: EditorView | undefined;

function editor(doc: string, anchor = doc.length, head = anchor): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(anchor, head),
      extensions: [history()],
    }),
  });
  return view;
}

const text = (v: EditorView) => v.state.doc.toString();
const cursor = (v: EditorView) => v.state.selection.main.head;

afterEach(() => {
  view?.destroy();
  view = undefined;
});

describe('insertSymbol', () => {
  it.each([
    ['{', '{}'],
    ['(', '()'],
    ['[', '[]'],
    ["'", "''"],
    ['"', '""'],
    ['`', '``'],
  ])('inserts %s with its partner and leaves the cursor between', (key, pair) => {
    const v = editor('');
    insertSymbol(v, key);
    expect(text(v)).toBe(pair);
    expect(cursor(v)).toBe(1);
  });

  it('pairs even in front of a word, because the key shows a pair', () => {
    const v = editor('total', 0);
    insertSymbol(v, '(');
    expect(text(v)).toBe('()total');
    expect(cursor(v)).toBe(1);
  });

  it('wraps a selection instead of replacing it', () => {
    const v = editor('a + b', 0, 5);
    insertSymbol(v, '(');
    expect(text(v)).toBe('(a + b)');
    expect(v.state.selection.main.from).toBe(1);
    expect(v.state.selection.main.to).toBe(6);
  });

  it('steps over a closer that is already there', () => {
    const v = editor('{}', 1);
    insertSymbol(v, '}');
    expect(text(v)).toBe('{}');
    expect(cursor(v)).toBe(2);
  });

  it('inserts plain symbols as typed, the arrow included', () => {
    const v = editor('(x) ');
    insertSymbol(v, '=>');
    expect(text(v)).toBe('(x) =>');
    expect(cursor(v)).toBe(6);
  });

  it('leaves a read-only document alone', () => {
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: 'x', extensions: [EditorState.readOnly.of(true)] }),
    });
    insertSymbol(view, '{');
    expect(text(view)).toBe('x');
  });
});

describe('runSymbolAction', () => {
  it('indents and outdents the current line by one unit', () => {
    const v = editor('return 1;');
    runSymbolAction(v, 'indent');
    expect(text(v)).toBe('  return 1;');
    runSymbolAction(v, 'outdent');
    expect(text(v)).toBe('return 1;');
  });

  it('undoes and redoes an insertion', () => {
    const v = editor('');
    insertSymbol(v, '{');
    runSymbolAction(v, 'undo');
    expect(text(v)).toBe('');
    runSymbolAction(v, 'redo');
    expect(text(v)).toBe('{}');
  });
});

describe('typed brackets', () => {
  const state = (doc: string, at: number) =>
    EditorState.create({ doc, selection: EditorSelection.single(at) });

  it('does not pair an opener typed in front of a word', () => {
    expect(bracketInsertion(state('total', 0), '(')).toBeNull();
  });

  it('does not pair an apostrophe typed after a letter', () => {
    expect(bracketInsertion(state('don', 3), "'")).toBeNull();
  });

  it('treats ordinary characters as ordinary typing', () => {
    expect(bracketInsertion(state('', 0), 'a')).toBeNull();
  });

  it('removes both halves of an empty pair on Backspace', () => {
    const before = state('f()', 2);
    const spec = pairDeletion(before);
    expect(spec).not.toBeNull();
    expect(before.update(spec ?? {}).state.doc.toString()).toBe('f');
  });

  it('leaves Backspace alone anywhere else', () => {
    expect(pairDeletion(state('f(x)', 3))).toBeNull();
  });
});

const LANGUAGES: EditorLanguage[] = ['js', 'ts', 'tsx', 'python', 'html', 'css', 'sql'];
const glyphs = (keys: readonly SymbolKey[]) =>
  keys.flatMap((k) => (k.kind === 'text' ? [k.text] : [`[${k.action}]`]));

describe('symbolKeysFor', () => {
  it.each([
    ['js', "( ) { } ; = . '"],
    ['ts', '( ) { } : ; = .'],
    ['tsx', '< > / { } ( ) ='],
    ['python', ": ( ) ' = _ [ ]"],
    ['html', '< > / = " \' ! -'],
    ['css', '{ } : ; . # - ('],
    ['sql', "* ( ) ' , ; = <"],
  ] as const)('puts what %s needs most on the first screen of seven keys', (language, first) => {
    expect(glyphs(symbolKeysFor(language)).slice(0, 7).join(' ')).toBe(
      first.split(' ').slice(0, 7).join(' '),
    );
  });

  it.each(LANGUAGES)('%s: every key once, and Indent, Outdent and Redo in the row', (language) => {
    const keys = symbolKeysFor(language);
    const labels = keys.map((k) => k.label);
    expect(new Set(labels).size).toBe(labels.length);
    const actions = keys.flatMap((k) => (k.kind === 'action' ? [k.action] : []));
    expect(actions.sort()).toEqual(['indent', 'outdent', 'redo']);
  });

  it('leaves out what a language never types: no arrow in Python, no backticks in SQL', () => {
    expect(glyphs(symbolKeysFor('python'))).not.toContain('=>');
    expect(glyphs(symbolKeysFor('sql'))).not.toContain('`');
    expect(glyphs(symbolKeysFor('js'))).toContain('=>');
  });

  it('pins Undo alone, with Redo on a long press', () => {
    expect(PINNED_KEYS.map((k) => k.label)).toEqual(['Undo']);
    const undoKey = PINNED_KEYS[0];
    expect(undoKey?.alt).toMatchObject({ kind: 'action', action: 'redo' });
  });

  it('gives brackets, quotes and stops a partner on a long press', () => {
    const alt = (text: string) =>
      symbolKeysFor('js').find((k) => k.kind === 'text' && k.text === text)?.alt;
    expect(alt('(')).toMatchObject({ text: '[' });
    expect(alt("'")).toMatchObject({ text: '"' });
    expect(alt('.')).toMatchObject({ text: ',' });
    expect(alt(';')).toMatchObject({ text: ':' });
  });

  it('presses the alternate when asked', () => {
    const v = editor('');
    const round = symbolKeysFor('js').find((k) => k.kind === 'text' && k.text === '(');
    if (!round) throw new Error('no key');
    pressSymbolKey(v, round, true);
    expect(text(v)).toBe('[]');
  });
});
