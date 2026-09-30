import type { EditorState } from '@codemirror/state';
import type { EditorLanguage } from './extensions';
import { templatePreview } from './snippet';

/*
 * The suggestion row above the phone keyboard. What it may offer is a teaching decision,
 * recorded in docs/MOBILE-EDITING.md, section 4:
 *
 * - `unplugged` (the code challenge) finishes what the learner started and nothing else:
 *   a keyword, or a word already in the file, and only after the first letter. A keyword
 *   that opens a block brings the brackets its grammar demands. Nothing from outside the
 *   file, so the row never tells the learner what to write.
 * - `live` (playground and sql steps) adds a small vocabulary of the language: HTML tags,
 *   CSS properties and values, a few browser words, and the tables of the step's database.
 * - `exam` (the online-test simulator) offers what `unplugged` offers. At a desk it also
 *   brings a completion list, on Ctrl-Space only (exam.ts), as the test's own editor does.
 *
 * Plain functions of the editor state, computed on the device at every change: a lesson
 * file is a few hundred words at most.
 */

export type AssistMode = 'unplugged' | 'live' | 'exam';

export interface Suggestion {
  /** What the chip shows: the word, or the block on one line (`if () {}`). */
  label: string;
  /** What is inserted, in the template syntax of snippet.ts. */
  template: string;
  /** The range the chip replaces: the word typed so far, and the `<` of a tag. */
  from: number;
  to: number;
}

export interface SuggestOptions {
  language: EditorLanguage;
  mode: AssistMode;
  /** Words the step knows about, such as its tables and columns. */
  vocabulary?: readonly string[];
  limit?: number;
}

const LIMIT = 8;

const JS_KEYWORDS = [
  'const',
  'let',
  'function',
  'return',
  'if',
  'else',
  'for',
  'of',
  'while',
  'true',
  'false',
  'null',
  'undefined',
  'new',
  'this',
  'class',
  'extends',
  'switch',
  'case',
  'break',
  'continue',
  'default',
  'try',
  'catch',
  'finally',
  'throw',
  'typeof',
  'instanceof',
  'in',
  'import',
  'export',
  'from',
  'async',
  'await',
  'yield',
  'delete',
  'do',
  'static',
  'super',
  'void',
  'var',
];

const TS_KEYWORDS = [
  'interface',
  'type',
  'string',
  'number',
  'boolean',
  'readonly',
  'unknown',
  'never',
  'keyof',
  'enum',
  'implements',
  'private',
  'public',
  'as',
  'satisfies',
];

const PYTHON_KEYWORDS = [
  'def',
  'return',
  'if',
  'elif',
  'else',
  'for',
  'in',
  'while',
  'True',
  'False',
  'None',
  'and',
  'or',
  'not',
  'is',
  'class',
  'try',
  'except',
  'finally',
  'raise',
  'with',
  'as',
  'import',
  'from',
  'pass',
  'break',
  'continue',
  'lambda',
  'yield',
  'async',
  'await',
  'global',
  'nonlocal',
  'assert',
  'del',
];

const SQL_KEYWORDS = [
  'select',
  'from',
  'where',
  'and',
  'or',
  'not',
  'null',
  'is',
  'in',
  'like',
  'between',
  'order',
  'by',
  'group',
  'having',
  'limit',
  'offset',
  'as',
  'distinct',
  'join',
  'left',
  'inner',
  'on',
  'insert',
  'into',
  'values',
  'update',
  'set',
  'delete',
  'returning',
  'create',
  'table',
  'index',
  'alter',
  'drop',
  'primary',
  'key',
  'references',
  'unique',
  'check',
  'default',
  'constraint',
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'case',
  'when',
  'then',
  'else',
  'end',
  'begin',
  'commit',
  'rollback',
  'asc',
  'desc',
  'text',
  'integer',
  'numeric',
  'boolean',
  'timestamptz',
  'serial',
];

/** Keywords that open a block, and the block. `\t` is one indent, `${}` a gap. */
const JS_BLOCKS: Readonly<Record<string, string>> = {
  if: 'if (${}) {\n\t${}\n}',
  else: 'else {\n\t${}\n}',
  for: 'for (${}) {\n\t${}\n}',
  while: 'while (${}) {\n\t${}\n}',
  function: 'function ${}(${}) {\n\t${}\n}',
  switch: 'switch (${}) {\n\t${}\n}',
  try: 'try {\n\t${}\n} catch (${}) {\n\t${}\n}',
  class: 'class ${} {\n\t${}\n}',
};

const PYTHON_BLOCKS: Readonly<Record<string, string>> = {
  if: 'if ${}:\n\t${}',
  elif: 'elif ${}:\n\t${}',
  else: 'else:\n\t${}',
  for: 'for ${} in ${}:\n\t${}',
  while: 'while ${}:\n\t${}',
  def: 'def ${}(${}):\n\t${}',
  class: 'class ${}:\n\t${}',
  try: 'try:\n\t${}\nexcept ${}:\n\t${}',
};

/** Browser words for a playground script. A playground is for trying, not for recall. */
const SCRIPT_WORDS = [
  'document',
  'querySelector',
  'querySelectorAll',
  'addEventListener',
  'textContent',
  'classList',
  'toggle',
  'createElement',
  'append',
  'value',
  'event',
  'preventDefault',
];
const SCRIPT_SNIPPETS: Readonly<Record<string, string>> = { console: 'console.log(${})' };

const REACT_WORDS = [
  'useState',
  'useEffect',
  'className',
  'onClick',
  'onChange',
  'props',
  'key',
  'children',
];

/** In the order a beginner reaches for them. `p` before `pre`: the first match leads. */
const HTML_TAGS = [
  'p',
  'a',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'img',
  'button',
  'input',
  'label',
  'form',
  'section',
  'header',
  'footer',
  'main',
  'nav',
  'article',
  'strong',
  'em',
  'code',
  'pre',
  'table',
  'tr',
  'th',
  'td',
  'br',
];
const VOID_TAGS: Readonly<Record<string, string>> = {
  img: '<img src="${}" alt="${}">',
  input: '<input ${}>',
  br: '<br>',
};

const CSS_VALUES: Readonly<Record<string, readonly string[]>> = {
  display: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['wrap', 'nowrap'],
  'justify-content': ['center', 'space-between', 'space-around', 'space-evenly', 'start', 'end'],
  'align-items': ['center', 'stretch', 'start', 'end', 'baseline'],
  position: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  'text-align': ['left', 'center', 'right', 'start', 'end'],
  'box-sizing': ['border-box', 'content-box'],
  overflow: ['visible', 'hidden', 'auto', 'scroll', 'clip'],
  'font-weight': ['400', '500', '600', '700', 'normal', 'bold'],
  cursor: ['pointer', 'default'],
  'list-style': ['none'],
};

const CSS_PROPERTIES = [
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'gap',
  'grid-template-columns',
  'margin',
  'padding',
  'width',
  'height',
  'max-width',
  'min-height',
  'color',
  'background',
  'border',
  'border-radius',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'text-align',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'overflow',
  'box-sizing',
  'opacity',
  'transition',
  'cursor',
  'list-style',
];

interface Grammar {
  /** A word as the language spells it, anchored at the end of the text before the caret. */
  word: RegExp;
  /** Every word in a document. */
  words: RegExp;
  caseless: boolean;
}

const IDENT: Grammar = { word: /[A-Za-z_$][\w$]*$/, words: /[A-Za-z_$][\w$]*/g, caseless: false };
const GRAMMAR: Readonly<Record<EditorLanguage, Grammar>> = {
  js: IDENT,
  ts: IDENT,
  tsx: IDENT,
  python: { word: /[A-Za-z_]\w*$/, words: /[A-Za-z_]\w*/g, caseless: false },
  sql: { word: /[A-Za-z_]\w*$/, words: /[A-Za-z_]\w*/g, caseless: true },
  html: { word: /[A-Za-z][\w-]*$/, words: /[A-Za-z][\w-]*/g, caseless: true },
  css: { word: /-{0,2}[A-Za-z_][\w-]*$/, words: /-{0,2}[A-Za-z_][\w-]*/g, caseless: true },
};

interface Candidate {
  word: string;
  template?: string;
}

/** The words of the document, nearest to the caret first, the one being typed left out. */
function documentWords(state: EditorState, grammar: Grammar, from: number, to: number): string[] {
  const text = state.doc.toString();
  const nearest = new Map<string, number>();
  for (const match of text.matchAll(grammar.words)) {
    const start = match.index;
    if (start === from && start + match[0].length === to) continue;
    if (match[0].length < 2) continue;
    const distance = Math.abs(start - from);
    const known = nearest.get(match[0]);
    if (known === undefined || distance < known) nearest.set(match[0], distance);
  }
  return [...nearest.entries()].sort((a, b) => a[1] - b[1]).map(([word]) => word);
}

/** The language's keywords, without the blocks some of them open. */
export function languageKeywords(language: EditorLanguage): readonly string[] {
  return keywordsFor(language).words;
}

function keywordsFor(language: EditorLanguage): {
  words: readonly string[];
  blocks: Readonly<Record<string, string>>;
} {
  switch (language) {
    case 'js':
      return { words: JS_KEYWORDS, blocks: JS_BLOCKS };
    case 'ts':
    case 'tsx':
      return { words: [...JS_KEYWORDS, ...TS_KEYWORDS], blocks: JS_BLOCKS };
    case 'python':
      return { words: PYTHON_KEYWORDS, blocks: PYTHON_BLOCKS };
    case 'sql':
      return { words: SQL_KEYWORDS, blocks: {} };
    default:
      return { words: [], blocks: {} };
  }
}

function liveWords(language: EditorLanguage): Candidate[] {
  if (language === 'js' || language === 'ts') {
    return [
      ...Object.entries(SCRIPT_SNIPPETS).map(([word, template]) => ({ word, template })),
      ...SCRIPT_WORDS.map((word) => ({ word })),
    ];
  }
  if (language === 'tsx') return REACT_WORDS.map((word) => ({ word }));
  return [];
}

function openBraces(text: string): number {
  let depth = 0;
  for (const char of text) {
    if (char === '{') depth += 1;
    else if (char === '}') depth = Math.max(0, depth - 1);
  }
  return depth;
}

/** CSS by position: a property where a declaration starts, a value after its colon. */
function cssCandidates(state: EditorState, from: number): Candidate[] | null {
  const line = state.doc.lineAt(from);
  const before = line.text.slice(0, from - line.from);
  const value = /([a-z-]+)\s*:\s*[^;{}]*$/.exec(before);
  if (value) return (CSS_VALUES[value[1] ?? ''] ?? []).map((word) => ({ word }));
  const inBlock = openBraces(state.sliceDoc(0, from)) > 0;
  if (inBlock && /(^|[{;])\s*$/.test(before)) {
    return CSS_PROPERTIES.map((word) => ({ word, template: `${word}: \${};` }));
  }
  return null;
}

export function suggest(state: EditorState, options: SuggestOptions): Suggestion[] {
  const { language, mode, vocabulary = [], limit = LIMIT } = options;
  const main = state.selection.main;
  if (!main.empty) return [];
  const pos = main.head;
  const grammar = GRAMMAR[language];
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  // In the middle of a word, a completion would leave its tail behind.
  if (/^[\w$]/.test(line.text.slice(pos - line.from))) return [];

  const prefix = grammar.word.exec(before)?.[0] ?? '';
  let from = pos - prefix.length;
  const live = mode === 'live';

  let candidates: Candidate[] = [];
  let contextual = false;
  if (live && language === 'html' && state.sliceDoc(from - 1, from) === '<') {
    from -= 1;
    contextual = true;
    candidates = HTML_TAGS.map((tag) => ({
      word: tag,
      template: VOID_TAGS[tag] ?? `<${tag}>\${}</${tag}>`,
    }));
  } else if (live && language === 'css') {
    const css = cssCandidates(state, pos - prefix.length);
    if (css) {
      contextual = true;
      candidates = css;
    }
  }

  // Only a context (after `<`, after a colon) may suggest before the first letter.
  if (prefix === '' && !contextual) return [];

  if (prefix !== '' && (!contextual || language === 'css')) {
    const { words, blocks } = keywordsFor(language);
    candidates = [
      ...candidates,
      ...documentWords(state, grammar, pos - prefix.length, pos).map((word) => ({ word })),
      ...words.map((word) => ({ word, template: blocks[word] })),
      ...(live ? liveWords(language) : []),
      ...vocabulary.map((word) => ({ word })),
    ];
  }

  const lower = prefix.toLowerCase();
  const upper = language === 'sql' && /[A-Z]/.test(prefix) && prefix === prefix.toUpperCase();
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const candidate of candidates) {
    const word = candidate.word;
    const matches = grammar.caseless
      ? word.toLowerCase().startsWith(lower)
      : word.startsWith(prefix);
    if (!matches) continue;
    // A word already typed in full needs no chip. A block still does: it adds the brackets.
    if (!candidate.template && word.length === prefix.length) continue;
    const shown = upper ? word.toUpperCase() : word;
    const template = candidate.template ?? shown;
    const label = candidate.template ? templatePreview(template) : shown;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, template, from, to: pos });
    if (out.length === limit) break;
  }
  return out;
}
