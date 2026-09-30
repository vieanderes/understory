import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { hangOf } from '@/core/content/indent';

/*
 * On a phone a long line wraps, and a wrapped row that starts at the left edge reads as a
 * new line of code: a comment in a function body turns into three ragged lines that look
 * like three statements. Each wrapped row here starts under the line's own code, two
 * columns further in, the way a writer indents a continued line by hand. The first row
 * keeps its indent; only the rows after it move. docs/MOBILE-EDITING.md, section 8.1.
 *
 * The build (scripts/lib/render.ts) gives the highlighted starter the same indent, so
 * the swap from placeholder to editor moves nothing.
 */

const cache = new Map<number, Decoration>();

function hang(columns: number): Decoration {
  let deco = cache.get(columns);
  if (!deco) {
    deco = Decoration.line({ attributes: { style: `--hang: ${columns}ch` }, class: 'cm-hang' });
    cache.set(columns, deco);
  }
  return deco;
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tabSize = view.state.tabSize;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = view.state.doc.lineAt(pos);
      builder.add(line.from, line.from, hang(hangOf(line.text, tabSize)));
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export function hangingIndent(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = build(view);
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
    EditorView.theme({
      // The row after a wrap starts at the padding, the first row at the edge. The text
      // column keeps its width, so a line breaks at the same word as in the placeholder.
      '.cm-line.cm-hang': {
        paddingLeft: 'var(--hang)',
        textIndent: 'calc(-1 * var(--hang))',
      },
    }),
  ];
}
