import { history, undo } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import {
  activeField,
  clearFields,
  expandTemplate,
  hasFields,
  insertSnippet,
  nextField,
  prevField,
  snippetFields,
  templatePreview,
} from '@/features/editor/snippet';

let view: EditorView | undefined;

function editor(doc: string, anchor = doc.length, unit = '  '): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(anchor),
      extensions: [history(), indentUnit.of(unit), snippetFields()],
    }),
  });
  return view;
}

const text = (v: EditorView) => v.state.doc.toString();
const selected = (v: EditorView) => {
  const { from, to } = v.state.selection.main;
  return [from, to];
};

afterEach(() => {
  view?.destroy();
  view = undefined;
});

describe('expandTemplate', () => {
  it('lays out lines with the indent of the line it starts on, and finds the fields', () => {
    const out = expandTemplate('if (${}) {\n\t${}\n}', '  ', '    ');
    expect(out.text).toBe('if () {\n      \n    }');
    // The condition, the body, and the end of the block as the last stop.
    expect(out.fields).toEqual([
      { from: 4, to: 4 },
      { from: 14, to: 14 },
      { from: 20, to: 20 },
    ]);
  });

  it('keeps default text in a field, so it arrives selected', () => {
    const out = expandTemplate('const ${name} = ${};', '  ', '');
    expect(out.text).toBe('const name = ;');
    expect(out.fields[0]).toEqual({ from: 6, to: 10 });
  });

  it('does not add an end stop when the template already ends in a field', () => {
    expect(expandTemplate('<p>${}</p>${}', '  ', '').fields).toHaveLength(2);
  });

  it('adds nothing when the template has no fields', () => {
    expect(expandTemplate('else', '  ', '').fields).toEqual([]);
  });
});

describe('templatePreview', () => {
  it.each([
    ['if (${}) {\n\t${}\n}', 'if () {}'],
    ['def ${}(${}):\n\t${}', 'def ():'],
    ['<div>${}</div>', '<div></div>'],
    ['display: ${};', 'display: ;'],
    ['const ${name} = ${};', 'const name = ;'],
  ])('shows %j as %j', (template, preview) => {
    expect(templatePreview(template)).toBe(preview);
  });
});

describe('insertSnippet', () => {
  it('replaces the typed word and selects the first field', () => {
    const v = editor('  i', 3);
    insertSnippet(v, 'if (${}) {\n\t${}\n}', 2, 3);
    expect(text(v)).toBe('  if () {\n    \n  }');
    expect(selected(v)).toEqual([6, 6]);
    expect(hasFields(v.state)).toBe(true);
  });

  it('moves through the fields and ends after the block', () => {
    const v = editor('i');
    insertSnippet(v, 'if (${}) {\n\t${}\n}', 0, 1);
    v.dispatch(v.state.replaceSelection('ok'));
    expect(text(v)).toBe('if (ok) {\n  \n}');

    expect(nextField(v)).toBe(true);
    expect(selected(v)).toEqual([12, 12]);
    v.dispatch(v.state.replaceSelection('go()'));

    expect(nextField(v)).toBe(true);
    expect(selected(v)).toEqual([text(v).length, text(v).length]);
    // The last stop ends the snippet: Tab is an indent again.
    expect(hasFields(v.state)).toBe(false);
    expect(nextField(v)).toBe(false);
  });

  it('goes back to an earlier field, with what was typed there selected', () => {
    const v = editor('');
    insertSnippet(v, 'f(${}, ${})', 0, 0);
    v.dispatch(v.state.replaceSelection('a'));
    nextField(v);
    expect(prevField(v)).toBe(true);
    expect(selected(v)).toEqual([2, 3]);
    expect(activeField(v.state)).toBe(0);
    expect(prevField(v)).toBe(false);
  });

  it('keeps fields in place when text is typed before them', () => {
    const v = editor('x');
    insertSnippet(v, 'f(${}, ${})', 1, 1);
    v.dispatch({ changes: { from: 0, insert: 'yy' } });
    nextField(v);
    expect(selected(v)).toEqual([7, 7]);
  });

  it('puts the cursor at the end of a template without fields and starts no session', () => {
    const v = editor('el');
    insertSnippet(v, 'else', 0, 2);
    expect(text(v)).toBe('else');
    expect(selected(v)).toEqual([4, 4]);
    expect(hasFields(v.state)).toBe(false);
  });

  it('is one undo step', () => {
    const v = editor('i');
    insertSnippet(v, 'if (${}) {\n\t${}\n}', 0, 1);
    undo(v);
    expect(text(v)).toBe('i');
  });

  it('ends on clearFields and when the document is replaced', () => {
    const v = editor('');
    insertSnippet(v, 'f(${}, ${})', 0, 0);
    expect(clearFields(v)).toBe(true);
    expect(hasFields(v.state)).toBe(false);
    expect(clearFields(v)).toBe(false);

    insertSnippet(v, 'g(${})', 0, 0);
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: 'new' } });
    expect(hasFields(v.state)).toBe(false);
  });

  it('does nothing in a read-only editor', () => {
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc: 'i', extensions: [EditorState.readOnly.of(true)] }),
    });
    insertSnippet(view, 'if', 0, 1);
    expect(view.state.doc.toString()).toBe('i');
  });
});
