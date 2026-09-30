import {
  autocompletion,
  completeAnyWord,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { codeFolding, foldGutter, foldKeymap } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { EditorLanguage } from './extensions';
import { createSearchPanel } from './search-panel';
import { languageKeywords } from './suggestions';

/*
 * The online test's editor (docs/ONLINE-TEST.md): what the test's own editor offers on
 * top of the lesson editor. A chunk of its own, fetched only when a test is on screen, so
 * no lesson pays for search, folding or the completion list
 * (tests/e2e/bundle-budget.spec.ts).
 *
 * Toggle comment (Mod-/), move line (Alt-Up and Alt-Down) and go to the matching bracket
 * (Shift-Mod-\) are in the default keymap every editor already has. Ctrl-M is not bound:
 * CodeMirror keeps it for its Tab focus mode.
 */

/**
 * "Simple autocomplete": the words already in the file and the language's keywords, and
 * only when asked for with Ctrl-Space. Nothing pops up while typing, and nothing knows
 * what the code means, as in the test.
 */
function simpleCompletion(language: EditorLanguage) {
  const keywords = languageKeywords(language);
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const found = await completeAnyWord(context);
    if (!found) return null;
    // A word the file already uses and the language also knows is offered once.
    const words = new Set(found.options.map((option) => option.label));
    const options: Completion[] = [
      ...found.options,
      ...keywords.filter((word) => !words.has(word)).map((label) => ({ label, type: 'keyword' })),
    ];
    return { ...found, options };
  };
}

/** The chevrons of the lucide icons, drawn at 2 px like every other icon. */
function chevron(open: boolean): HTMLElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [name, value] of [
    ['viewBox', '0 0 24 24'],
    ['fill', 'none'],
    ['stroke', 'currentColor'],
    ['stroke-width', '2'],
    ['stroke-linecap', 'round'],
    ['stroke-linejoin', 'round'],
    ['aria-hidden', 'true'],
  ] as const) {
    svg.setAttribute(name, value);
  }
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', open ? 'm6 9 6 6 6-6' : 'm9 18 6-6-6-6');
  svg.append(path);
  const marker = document.createElement('span');
  marker.append(svg);
  return marker;
}

/** Interface copy in the app's voice: sentence case, British English. */
const phrases = EditorState.phrases.of({
  Find: 'Find',
  Replace: 'Replace with',
  next: 'Next',
  previous: 'Previous',
  all: 'Select all',
  'match case': 'Match case',
  regexp: 'Regex',
  'by word': 'Whole word',
  replace: 'Replace',
  'replace all': 'Replace all',
  close: 'Close',
  'Go to line': 'Go to line',
  go: 'Go',
  'current match': 'Current match',
  'on line': 'on line',
  'folded code': 'Folded code',
  'Folded lines': 'Folded lines',
  'Unfolded lines': 'Unfolded lines',
  to: 'to',
  unfold: 'Unfold',
  'Fold line': 'Fold',
  'Unfold line': 'Unfold',
  Completions: 'Completions',
});

/** The lucide `x`, as a mask, so it takes the button's text colour. */
const CLOSE_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 6 6 18M6 6l12 12'/%3E%3C/svg%3E\")";

/*
 * Tokens only, and every rule under `&.cm-editor`, so it outranks the light and dark
 * defaults of CodeMirror's own base themes (their fixed greys and yellow matches).
 */
const examTheme = EditorView.theme({
  '&.cm-editor .cm-content': { tabSize: '4' },
  // The fold column sits between the numbers and the code, a chevron where a block opens.
  '&.cm-editor .cm-foldGutter .cm-gutterElement': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1rem',
    color: 'var(--faint)',
    cursor: 'pointer',
  },
  '&.cm-editor .cm-foldGutter .cm-gutterElement:hover': { color: 'var(--fg)' },
  '&.cm-editor .cm-foldGutter span': { display: 'flex' },
  '&.cm-editor .cm-foldGutter svg': { width: '0.75rem', height: '0.75rem' },
  '&.cm-editor .cm-foldPlaceholder': {
    backgroundColor: 'var(--sunken)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-inner)',
    color: 'var(--muted)',
    padding: '0 0.25rem',
    margin: '0 0.25rem',
  },
  // Search: the panel sits on the editor's top edge, on the raised tone of a toolbar.
  '&.cm-editor .cm-panels': {
    backgroundColor: 'var(--raised)',
    color: 'var(--fg)',
    fontFamily: 'var(--face-text)',
  },
  '&.cm-editor .cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '&.cm-editor .cm-panels-bottom': { borderTop: '1px solid var(--border)' },
  // Rows of a field and its buttons (search-panel.ts); the buttons wrap under a narrow field.
  '&.cm-editor .cm-panel.cm-search': {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.5rem 3rem 0.5rem 0.5rem',
    fontSize: 'var(--text-sm)',
  },
  '&.cm-editor .cm-searchRow, &.cm-editor .cm-searchControls, &.cm-editor .cm-searchOptions': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
  },
  // The fields share one width, so the buttons beside them line up.
  '&.cm-editor .cm-searchRow .cm-textfield': { flex: '1 1 12rem', maxWidth: '20rem' },
  '&.cm-editor .cm-searchOptions': { columnGap: '1rem' },
  '&.cm-editor .cm-panel.cm-search input, &.cm-editor .cm-panel.cm-search button, &.cm-editor .cm-panel.cm-search label':
    { margin: '0' },
  '&.cm-editor .cm-panel.cm-search label': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: 'var(--text-sm)',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  '&.cm-editor .cm-panel.cm-search input[type=checkbox]': {
    margin: '0',
    accentColor: 'var(--fg)',
  },
  '&.cm-editor .cm-textfield': {
    height: '2rem',
    minWidth: '0',
    padding: '0 0.5rem',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--face-mono)',
    color: 'var(--fg)',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-inner)',
  },
  '&.cm-editor .cm-textfield::placeholder': { color: 'var(--faint)' },
  '&.cm-editor .cm-button': {
    height: '2rem',
    padding: '0 0.75rem',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--face-text)',
    fontWeight: '500',
    color: 'var(--fg)',
    backgroundColor: 'var(--surface)',
    backgroundImage: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-inner)',
    cursor: 'pointer',
  },
  '&.cm-editor .cm-button:hover': { backgroundColor: 'var(--sunken)' },
  '&.cm-editor .cm-button:active': { backgroundImage: 'none', backgroundColor: 'var(--sunken)' },
  '&.cm-editor .cm-panel.cm-search [name=close]': {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    width: '2rem',
    height: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0',
    color: 'var(--muted)',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-inner)',
    cursor: 'pointer',
  },
  '&.cm-editor .cm-panel.cm-search [name=close]::before': {
    content: '""',
    width: '1rem',
    height: '1rem',
    backgroundColor: 'currentColor',
    maskImage: CLOSE_ICON,
    maskSize: '100% 100%',
  },
  '&.cm-editor .cm-panel.cm-search [name=close]:hover': {
    color: 'var(--fg)',
    backgroundColor: 'var(--sunken)',
  },
  '&.cm-editor .cm-panel :focus-visible': {
    outline: '2px solid var(--accent)',
    outlineOffset: '1px',
  },
  // Matches: the selection's tint for every match, and a text-coloured edge on the current one.
  '&.cm-editor .cm-searchMatch': {
    backgroundColor: 'var(--accent-tint)',
    borderRadius: '2px',
  },
  '&.cm-editor .cm-searchMatch-selected': {
    backgroundColor: 'var(--accent-tint)',
    boxShadow: '0 0 0 1px var(--fg)',
  },
  // The completion list: a floating panel, like the app's menus.
  '&.cm-editor .cm-tooltip': {
    backgroundColor: 'var(--raised)',
    color: 'var(--fg)',
    border: 'none',
    borderRadius: 'var(--radius-control)',
    boxShadow: 'var(--shadow-float)',
    overflow: 'hidden',
  },
  '&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--face-mono)',
    maxHeight: '15rem',
    padding: '0.25rem',
  },
  '&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '0.125rem 0.5rem',
    lineHeight: '1.5rem',
    borderRadius: 'var(--radius-inner)',
  },
  '&.cm-editor .cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent-tint)',
    color: 'var(--fg)',
  },
  '&.cm-editor .cm-completionMatchedText': {
    textDecoration: 'none',
    fontWeight: '600',
  },
  '&.cm-editor .cm-completionDetail': { color: 'var(--muted)', fontStyle: 'normal' },
});

/** Everything the online test adds, for one language. */
export function examExtensions(language: EditorLanguage): Extension {
  return [
    phrases,
    codeFolding(),
    foldGutter({ markerDOM: chevron }),
    search({ top: true, createPanel: createSearchPanel }),
    autocompletion({
      activateOnTyping: false,
      override: [simpleCompletion(language)],
      // Words that start with what was typed, not ones that merely contain its letters.
      filterStrict: true,
      icons: false,
    }),
    keymap.of([...searchKeymap, ...foldKeymap]),
    examTheme,
  ];
}
