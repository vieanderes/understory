import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/**
 * The editor's look, from tokens only. The geometry repeats `.code-view pre` in
 * globals.css (1 px border, 1 rem padding, a 3 rem number gutter, 1.5 rem lines), so
 * the highlighted starter that holds the space and the live editor that replaces it
 * occupy the same box and nothing jumps.
 */
export function editorTheme(minLines: number) {
  return EditorView.theme({
    '&': {
      color: 'var(--fg)',
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-panel)',
      fontSize: 'var(--text-sm)',
      // The panel radius must clip the active-line band at the corners.
      overflow: 'hidden',
    },
    // One focus ring everywhere: the same 2 px accent ring as `:focus-visible`, drawn on
    // the panel instead of on the inner text surface.
    '&.cm-focused': {
      outline: '2px solid var(--accent)',
      outlineOffset: '2px',
    },
    '.cm-content:focus-visible': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--face-mono)',
      lineHeight: '1.5rem',
      overflowX: 'auto',
    },
    '.cm-content': {
      padding: '1rem 0',
      minHeight: `calc(${minLines} * 1.5rem + 2rem)`,
      caretColor: 'var(--fg)',
      tabSize: '2',
    },
    // `.code-view` has 1 rem on the <pre> and 1 rem on each line. Wrapped lines break at
    // the same word only if the text column is exactly as wide here.
    '.cm-line': { padding: '0 2rem 0 0' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--faint)',
      border: 'none',
    },
    '.cm-lineNumbers': { minWidth: '3rem' },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '3rem',
      padding: '0 1rem 0 0',
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    },
    // The band marks where typing goes, so it shows only while the editor has focus. At
    // rest the editor looks exactly like the highlighted starter it replaced.
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
    '&.cm-focused .cm-activeLine': { backgroundColor: 'var(--sunken)' },
    '&.cm-focused .cm-activeLineGutter': {
      backgroundColor: 'var(--sunken)',
      color: 'var(--muted)',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)', borderLeftWidth: '2px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'var(--accent-tint)' },
    '&.cm-focused .cm-matchingBracket, .cm-matchingBracket': {
      backgroundColor: 'transparent',
      boxShadow: 'inset 0 -2px 0 var(--muted)',
    },
    // The gaps of a block inserted from the suggestion row (snippet.ts): a quiet band, and
    // a dotted mark where a gap is still empty.
    '.cm-snippetField': {
      backgroundColor: 'var(--sunken)',
      boxShadow: 'inset 0 -1px 0 var(--muted)',
    },
    '.cm-snippetFieldPosition': {
      display: 'inline-block',
      verticalAlign: 'text-top',
      width: '0',
      height: '1.15em',
      margin: '0 -0.7px -0.7em',
      borderLeft: '1.4px dotted var(--muted)',
    },
    // An editable region (editable-region.ts): the lines to write carry the accent bar of
    // a gap to fill, on the text and on the number; the locked lines sit on the page tone.
    '.cm-editableLine': { boxShadow: 'inset 2px 0 0 var(--accent)' },
    '.cm-lineNumbers .cm-gutterElement.cm-editableGutter': { color: 'var(--fg)' },
    '.cm-lockedLine, .cm-lineNumbers .cm-gutterElement.cm-lockedGutter': {
      backgroundColor: 'var(--bg)',
    },
    '&.cm-focused .cm-lockedLine.cm-activeLine': { backgroundColor: 'var(--sunken)' },
    // Danger is kept for verdicts. A stray bracket gets no mark; the tests will say so.
    '&.cm-focused .cm-nonmatchingBracket, .cm-nonmatchingBracket': {
      backgroundColor: 'transparent',
    },
  });
}

/**
 * The online test's accessibility mode: code at the section size (20 px) on its own line
 * height, from the type scale, so it is still one of the four sizes. The class and the
 * two-class rules outrank both the base size and the touch screen's body size.
 */
export function largeTextTheme(minLines: number): Extension {
  return [
    EditorView.editorAttributes.of({ class: 'cm-largeText' }),
    EditorView.theme({
      '&.cm-editor.cm-largeText': { fontSize: 'var(--text-lg)' },
      '&.cm-largeText .cm-scroller': { lineHeight: 'var(--text-lg--line-height)' },
      '&.cm-largeText .cm-content': {
        minHeight: `calc(${minLines} * var(--text-lg--line-height) + 2rem)`,
      },
    }),
  ];
}
