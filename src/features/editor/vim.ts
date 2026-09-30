import { vim } from '@replit/codemirror-vim';
import type { Extension } from '@codemirror/state';
import { drawSelection, EditorView } from '@codemirror/view';

/*
 * Vim keys for the online test's editor setting. A chunk of its own, fetched the first
 * time someone turns Vim on (tests/e2e/bundle-budget.spec.ts): most people never do.
 * CodeEditor puts it first among the extensions, because Vim must see a key before
 * every other keymap.
 */

/** Tokens only, and under `&.cm-editor`, over Vim's own pink cursor and grey command line. */
const vimTheme = EditorView.theme({
  '&.cm-editor .cm-fat-cursor': {
    backgroundColor: 'var(--fg)',
    color: 'var(--surface)',
    outline: 'none',
  },
  '&.cm-editor:not(.cm-focused) .cm-fat-cursor': {
    backgroundColor: 'transparent',
    color: 'transparent',
    outline: '1px solid var(--muted)',
  },
  // The command line: a strip on the editor's bottom edge.
  '&.cm-editor .cm-panels': { backgroundColor: 'var(--raised)', color: 'var(--fg)' },
  '&.cm-editor .cm-panels-bottom': { borderTop: '1px solid var(--border)' },
  '&.cm-editor .cm-vim-panel': {
    padding: '0 0.5rem',
    minHeight: '1.5rem',
    fontFamily: 'var(--face-mono)',
    fontSize: 'var(--text-sm)',
    color: 'var(--fg)',
  },
  // `/` search marks its matches with the selection's tint, as the search panel does.
  '&.cm-editor .cm-searchMatch': { backgroundColor: 'var(--accent-tint)' },
  '&.cm-editor .cm-vim-panel input': {
    color: 'var(--fg)',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
});

export function vimExtensions(): Extension {
  // Visual mode draws its selection itself; without drawSelection it would not show.
  return [vim(), drawSelection(), vimTheme];
}
