import { history, selectAll, undo } from '@codemirror/commands';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { editableRegion } from '@/features/editor/editable-region';

const STARTER = [
  'function total(xs) {',
  '  let sum = 0;',
  '  // your loop',
  '  return sum;',
  '}',
].join('\n');
const REGION_START = STARTER.indexOf('  // your loop');

let view: EditorView | undefined;

function editor(doc = STARTER, range = '3'): EditorView {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(REGION_START),
      extensions: [history(), editableRegion(STARTER, range)],
    }),
  });
  return view;
}

const text = (v: EditorView) => v.state.doc.toString();

afterEach(() => {
  view?.destroy();
  view = undefined;
});

describe('editableRegion', () => {
  it('lets the region change and grow', () => {
    const v = editor();
    v.dispatch({
      changes: {
        from: REGION_START,
        to: REGION_START + '  // your loop'.length,
        insert: '  for (const x of xs) {\n    sum += x;\n  }',
      },
    });
    expect(text(v)).toContain('    sum += x;');
    // Typing at the new end of the region still works.
    const end = text(v).indexOf('\n  return');
    v.dispatch({ changes: { from: end, insert: ' // done' } });
    expect(text(v)).toContain('  } // done\n  return sum;');
  });

  it('drops a change on a locked line', () => {
    const v = editor();
    v.dispatch({ changes: { from: 2, insert: 'x' } });
    v.dispatch({ changes: { from: text(v).indexOf('return'), to: text(v).indexOf('return') + 6 } });
    expect(text(v)).toBe(STARTER);
  });

  it('drops the line break that joins the region to a locked line', () => {
    const v = editor();
    // Backspace at the start of the region would pull it onto line 2.
    v.dispatch({ changes: { from: REGION_START - 1, to: REGION_START } });
    expect(text(v)).toBe(STARTER);
  });

  it('empties only the region when everything is selected and deleted', () => {
    const v = editor();
    selectAll(v);
    v.dispatch(v.state.replaceSelection(''));
    expect(text(v)).toBe('function total(xs) {\n  let sum = 0;\n\n  return sum;\n}');
    // The caret waits in the emptied region, not at the top where the deletion began.
    expect(v.state.selection.main.head).toBe(REGION_START);
    // The empty region still takes typing.
    v.dispatch({ changes: { from: REGION_START, insert: '  sum = 1;' } });
    expect(text(v)).toContain('  let sum = 0;\n  sum = 1;\n  return sum;');
  });

  it('takes a paste of the whole file when its locked lines match', () => {
    const v = editor();
    const pasted = STARTER.replace('  // your loop', '  for (const x of xs) sum += x;');
    v.dispatch({ changes: { from: 0, to: text(v).length, insert: pasted } });
    expect(text(v)).toBe(pasted);
  });

  it('undoes inside the region', () => {
    const v = editor();
    v.dispatch({ changes: { from: REGION_START, insert: 'x' }, userEvent: 'input.type' });
    undo(v);
    expect(text(v)).toBe(STARTER);
  });

  it('marks the region lines and the locked lines', () => {
    const v = editor(STARTER, '2-3');
    expect(v.dom.querySelectorAll('.cm-editableLine')).toHaveLength(2);
    expect(v.dom.querySelectorAll('.cm-lockedLine')).toHaveLength(3);
  });

  it('puts a tapped caret on a locked line at the nearest place to type', () => {
    const v = editor();
    v.dispatch({ selection: EditorSelection.cursor(1), userEvent: 'select.pointer' });
    // After the indent of the first line to write.
    expect(v.state.selection.main.head).toBe(REGION_START + 2);
    v.dispatch({ selection: EditorSelection.cursor(text(v).length), userEvent: 'select.pointer' });
    expect(v.state.selection.main.head).toBe(REGION_START + '  // your loop'.length);
    // The keyboard may still walk every line.
    v.dispatch({ selection: EditorSelection.cursor(1), userEvent: 'select' });
    expect(v.state.selection.main.head).toBe(1);
  });

  it('has no lock for a draft whose locked lines changed, or for a range it cannot use', () => {
    const draft = STARTER.replace('let sum', 'var sum');
    const v = editor(draft);
    v.dispatch({ changes: { from: 0, insert: '// ' } });
    expect(text(v)).toBe(`// ${draft}`);
    view?.destroy();
    const w = editor(STARTER, '9-12');
    w.dispatch({ changes: { from: 0, insert: '// ' } });
    expect(text(w)).toBe(`// ${STARTER}`);
    expect(w.dom.querySelectorAll('.cm-lockedLine')).toHaveLength(0);
  });

  it('lets a change marked as not filtered through, as a Reset is', () => {
    const v = editor();
    v.dispatch({ changes: { from: 0, to: text(v).length, insert: 'other' }, filter: false });
    expect(text(v)).toBe('other');
  });
});
