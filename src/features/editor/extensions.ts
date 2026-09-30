import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { closeBrackets } from './close-brackets';
import { hangingIndent } from './hanging-indent';
import { understoryHighlight } from './highlight';
import { straightPunctuation } from './smart-punctuation';
import { snippetFields } from './snippet';

export type EditorLanguage = 'js' | 'ts' | 'tsx' | 'python' | 'html' | 'css' | 'sql';

/** Grammars that arrive in a chunk of their own, with the first playground or sql step. */
type LazyLanguage = 'html' | 'css' | 'sql';

const lazyGrammars = new Map<LazyLanguage, Extension>();

export const isMarkup = (language: EditorLanguage): language is 'html' | 'css' =>
  language === 'html' || language === 'css';

export const hasLazyGrammar = (language: EditorLanguage): language is LazyLanguage =>
  isMarkup(language) || language === 'sql';

/**
 * Loads the HTML, CSS or SQL grammar once. A code challenge never needs them, so they stay
 * out of the editor chunk (tests/e2e/bundle-budget.spec.ts); the editor shows plain text
 * for the moment it takes, then highlights. SQL is read as Postgres, the database the
 * sql step runs.
 */
export async function loadLazyGrammar(language: LazyLanguage): Promise<Extension> {
  const cached = lazyGrammars.get(language);
  if (cached) return cached;
  let grammar: Extension;
  if (language === 'html') grammar = (await import('@codemirror/lang-html')).html();
  else if (language === 'css') grammar = (await import('@codemirror/lang-css')).css();
  else {
    const { sql, PostgreSQL } = await import('@codemirror/lang-sql');
    grammar = sql({ dialect: PostgreSQL });
  }
  lazyGrammars.set(language, grammar);
  return grammar;
}

/*
 * Every extension is picked by hand. `basicSetup` would bring autocompletion, a search
 * panel, lint gutters and tooltips: this editor is where a learner proves they can write
 * the code themselves, so it helps with typing (indent, brackets, undo) and with
 * nothing else. The online test's editor is the one exception: it copies the test's own
 * editor, search and completion list included, from a chunk of its own (exam.ts).
 */

/**
 * The grammar and the indent that goes with it: two spaces for JavaScript and TypeScript,
 * four for Python, as PEP 8 and every Python course the learner will meet use.
 */
export function languageExtension(language: EditorLanguage, tabSize?: number): Extension {
  // The online test indents every language by four, as the test's own editor does.
  if (tabSize !== undefined) {
    return [
      languageExtension(language),
      Prec.high([indentUnit.of(' '.repeat(tabSize)), EditorState.tabSize.of(tabSize)]),
    ];
  }
  if (hasLazyGrammar(language)) {
    return [lazyGrammars.get(language) ?? [], indentUnit.of('  '), EditorState.tabSize.of(2)];
  }
  if (language === 'python') {
    return [python(), indentUnit.of('    '), EditorState.tabSize.of(4)];
  }
  return [
    javascript({ typescript: language !== 'js', jsx: language === 'tsx' }),
    indentUnit.of('  '),
    EditorState.tabSize.of(2),
  ];
}

export function readOnlyExtension(readOnly: boolean): Extension {
  if (!readOnly) return [];
  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ 'aria-readonly': 'true' }),
  ];
}

export function editingExtensions(onRun: () => void): Extension {
  return [
    history(),
    indentOnInput(),
    straightPunctuation(),
    closeBrackets(),
    // Before the keymap below: while a block from the suggestion row is being filled, Tab
    // moves to its next gap. Otherwise Tab falls through and indents.
    snippetFields(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    // Before the default keymap, which would otherwise insert a blank line.
    Prec.high(
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRun();
            return true;
          },
        },
      ]),
    ),
    // Tab indents. CodeMirror itself provides the way out for keyboard users: after
    // Escape, the next Tab is left to the browser and moves focus on. The hint under
    // the editor says so.
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  ];
}

/**
 * Cmd or Ctrl with S. The browser would offer to save the page; the online test saves
 * the code instead. Without a handler the key is left to the browser, as before.
 */
export function saveKeymap(onSave: () => boolean): Extension {
  return Prec.high(keymap.of([{ key: 'Mod-s', run: onSave }]));
}

/**
 * The online test's keys that cost nothing to load (the rest arrive with exam.ts): F9
 * runs, and Ctrl-Shift-M leaves the editor. Tab indents here, so a keyboard user needs a
 * way out that is always the same, whatever the editor is doing.
 */
export function examKeymap(onRun: () => void, onLeave: (view: EditorView) => void): Extension {
  return Prec.high(
    keymap.of([
      {
        key: 'F9',
        run: () => {
          onRun();
          return true;
        },
        preventDefault: true,
      },
      {
        key: 'Ctrl-Shift-m',
        run: (view) => {
          onLeave(view);
          return true;
        },
        preventDefault: true,
      },
    ]),
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Moves focus to the first focusable element after the editor, or just out of it. */
export function focusAfter(view: EditorView): void {
  const next = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (element) =>
      !view.dom.contains(element) &&
      !element.closest('[inert]') &&
      (view.dom.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );
  view.contentDOM.blur();
  next?.focus();
}

/**
 * What a touch screen needs on top. Text under 16 px makes iOS zoom the page in on every
 * tap into the editor and never zoom back out, so the editor steps up to the body size
 * (the placeholder does the same in globals.css). And the key rows ride on the keyboard
 * and cover the bottom of the visual viewport, so the caret is scrolled clear of them,
 * as CodeMirror already does for the keyboard itself. How much they cover changes as
 * the second row comes and goes, so it is read at every scroll.
 */
export function touchExtensions(barHeight: () => number): Extension {
  return [
    // Two classes, so it outranks the base theme's one-class `&` rule whatever the order.
    EditorView.theme({ '&.cm-editor': { fontSize: 'var(--text-base)' } }),
    EditorView.scrollMargins.of(() => ({ bottom: barHeight() })),
  ];
}

/**
 * Below 768 px: long lines wrap, and the rows after the first hang under the line's code
 * (hanging-indent.ts). The number column is 2 rem instead of 3 and the right padding
 * 0.5 rem instead of 2, which gives a 390 px phone 32 columns of code instead of 28. The
 * highlighted starter uses the same geometry (`.code-view.wrap` in globals.css).
 */
export function phoneExtensions(): Extension {
  return [
    EditorView.lineWrapping,
    hangingIndent(),
    // Two classes, so it outranks the base theme whatever the order.
    EditorView.theme({
      '&.cm-editor .cm-line': { paddingRight: '0.5rem' },
      '&.cm-editor .cm-lineNumbers': { minWidth: '2rem' },
      '&.cm-editor .cm-lineNumbers .cm-gutterElement': {
        minWidth: '2rem',
        paddingRight: '0.5rem',
      },
    }),
  ];
}

export function baseExtensions(ariaLabel: string): Extension {
  return [
    lineNumbers(),
    bracketMatching(),
    syntaxHighlighting(understoryHighlight),
    EditorView.contentAttributes.of({
      'aria-label': ariaLabel,
      // Editable content is focusable without this, but axe (and some assistive tools)
      // only count an explicit tabindex when they look for a way into a scrolling region.
      // Read-only content is not focusable at all without it.
      tabindex: '0',
      // A phone keyboard must not capitalise, correct or predict code.
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      // The return key starts a line. Without the hint some keyboards label it "Go".
      enterkeyhint: 'enter',
    }),
  ];
}
