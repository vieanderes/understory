import {
  EditorSelection,
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
  type Text,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutterLineClass,
  type DecorationSet,
} from '@codemirror/view';
import {
  lockedFrame,
  locateRegion,
  parseLineRange,
  type LockedFrame,
} from '@/core/content/editable';

/*
 * The editable region of a code challenge (docs/MOBILE-EDITING.md, section 8.4). The lines
 * around it are locked: a change there is dropped before it happens, the region's lines
 * carry the accent bar of a gap to fill, and a tap on a locked line puts the caret at the
 * nearest place the learner can type. Keyboard movement is left alone, so a screen reader
 * can still walk every line.
 */

interface Region {
  from: number;
  to: number;
}

/**
 * Found again from the locked text after every change instead of mapped: a Reset or a
 * restored draft replaces the whole document, and mapping would guess.
 */
function regionField(frame: LockedFrame) {
  const locate = (doc: Text): Region | null => locateRegion(doc.toString(), frame);
  return StateField.define<Region | null>({
    create: (state) => locate(state.doc),
    update: (value, tr) => (tr.docChanged ? locate(tr.newDoc) : value),
  });
}

class LineGutter extends GutterMarker {
  constructor(override readonly elementClass: string) {
    super();
  }
}
const regionGutter = new LineGutter('cm-editableGutter');
const lockedGutter = new LineGutter('cm-lockedGutter');

function lineDecorations(state: EditorState, region: Region | null): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  if (!region) return builder.finish();
  const first = state.doc.lineAt(region.from).number;
  const last = state.doc.lineAt(region.to).number;
  for (let n = 1; n <= state.doc.lines; n += 1) {
    const line = state.doc.line(n);
    const inside = n >= first && n <= last;
    builder.add(line.from, line.from, inside ? editableLine : lockedLine);
  }
  return builder.finish();
}

const editableLine = Decoration.line({ class: 'cm-editableLine' });
const lockedLine = Decoration.line({ class: 'cm-lockedLine' });

/**
 * Where a caret outside the region goes: the nearer edge. From above, that is after the
 * indent of the first line to write, where the code starts.
 */
function clamp(state: EditorState, pos: number, region: Region): number {
  if (pos > region.to) return region.to;
  if (pos >= region.from) return pos;
  const first = state.doc.sliceString(region.from, state.doc.lineAt(region.from).to);
  return Math.min(region.from + first.length - first.trimStart().length, region.to);
}

/**
 * Locks every line of `starter` outside `range` ("5-9"). An unusable range, or a document
 * whose locked lines were changed, gives no lock at all: the editor behaves as before.
 */
export function editableRegion(starter: string, range: string): Extension {
  const lines = parseLineRange(range);
  const frame = lines && lockedFrame(starter, lines);
  if (!frame) return [];
  const field = regionField(frame);

  return [
    field,
    EditorState.changeFilter.of((tr) => {
      const region = tr.startState.field(field);
      if (!region) return true;
      // Whatever leaves the locked text as it was goes through whole: a paste of the full
      // file, for one, when its scaffold matches.
      if (locateRegion(tr.newDoc.toString(), frame)) return true;
      // A pure insertion outside the region cannot be split off: drop the whole change.
      let outside = false;
      tr.changes.iterChangedRanges((fromA, toA) => {
        if (fromA === toA && (fromA < region.from || fromA > region.to)) outside = true;
      });
      if (outside) return false;
      // Otherwise keep what falls inside: select all and delete empties only the region.
      const locked: number[] = [];
      if (region.from > 0) locked.push(0, region.from);
      if (region.to < tr.startState.doc.length) locked.push(region.to, tr.startState.doc.length);
      return locked.length > 0 ? locked : true;
    }),
    EditorState.transactionFilter.of((tr) => {
      // After an edit (select all and delete leaves the caret at the top), or after a tap,
      // an empty caret outside the region moves to its nearer edge. A selection is left
      // alone, so locked code can still be copied, and so is the keyboard's caret, so a
      // screen reader can walk every line.
      if (!tr.docChanged && !tr.isUserEvent('select.pointer')) return tr;
      const region = tr.state.field(field);
      const main = tr.state.selection.main;
      if (!region || !main.empty) return tr;
      const pos = clamp(tr.state, main.head, region);
      if (pos === main.head) return tr;
      return [
        tr,
        { selection: EditorSelection.cursor(pos), scrollIntoView: true, sequential: true },
      ];
    }),
    EditorView.decorations.compute([field, 'doc'], (state) =>
      lineDecorations(state, state.field(field)),
    ),
    gutterLineClass.compute([field, 'doc'], (state) => {
      const region = state.field(field);
      const builder = new RangeSetBuilder<GutterMarker>();
      if (region) {
        const first = state.doc.lineAt(region.from).number;
        const last = state.doc.lineAt(region.to).number;
        for (let n = 1; n <= state.doc.lines; n += 1) {
          const line = state.doc.line(n);
          builder.add(line.from, line.from, n >= first && n <= last ? regionGutter : lockedGutter);
        }
      }
      return builder.finish();
    }),
  ];
}
