import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { closeBrackets } from '@/features/editor/close-brackets';
import { handleBentInput, straightenPunctuation } from '@/features/editor/smart-punctuation';

let view: EditorView | undefined;

afterEach(() => {
  view?.destroy();
  view = undefined;
});

function setup(doc = '', cursor = doc.length) {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, selection: { anchor: cursor }, extensions: closeBrackets() }),
  });
  return view;
}

describe('straightenPunctuation', () => {
  it('turns what iOS Smart Punctuation bends back into code', () => {
    expect(straightenPunctuation('“hi”')).toBe('"hi"');
    expect(straightenPunctuation('it’s')).toBe("it's");
    expect(straightenPunctuation('i—')).toBe('i--');
    expect(straightenPunctuation('a…')).toBe('a...');
  });

  it('leaves straight text alone', () => {
    const text = 'const s = "a" + \'b\';';
    expect(straightenPunctuation(text)).toBe(text);
  });
});

describe('handleBentInput', () => {
  it('lets straight text through to the next handler', () => {
    const v = setup();
    expect(handleBentInput(v, 0, 0, 'a')).toBe(false);
    expect(v.state.doc.toString()).toBe('');
  });

  it('pairs a bent quote as a straight one would be paired', () => {
    const v = setup();
    expect(handleBentInput(v, 0, 0, '“')).toBe(true);
    expect(v.state.doc.toString()).toBe('""');
    expect(v.state.selection.main.head).toBe(1);
  });

  it('steps over the closing quote instead of doubling it', () => {
    const v = setup('""', 1);
    expect(handleBentInput(v, 1, 1, '”')).toBe(true);
    expect(v.state.doc.toString()).toBe('""');
    expect(v.state.selection.main.head).toBe(2);
  });

  it('replaces a hyphen the keyboard swapped for a dash', () => {
    const v = setup('i-', 2);
    // iOS replaces the hyphen already typed with the dash: one change over both.
    expect(handleBentInput(v, 1, 2, '—')).toBe(true);
    expect(v.state.doc.toString()).toBe('i--');
    expect(v.state.selection.main.head).toBe(3);
  });

  it('does nothing in a read-only editor', () => {
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({ extensions: EditorState.readOnly.of(true) }),
    });
    expect(handleBentInput(view, 0, 0, '“')).toBe(false);
    expect(view.state.doc.toString()).toBe('');
  });
});
