import type { PlaygroundCheck } from '@/core/content/schema';
import { frameScript, LINE_PLACEHOLDER } from './probe';
import {
  compileErrorText,
  MODULE_PREFIX,
  REACT_ROOT_ID,
  reactFrameScript,
  type ComponentModule,
} from './react-page';

/*
 * The page a playground shows: the learner's HTML, CSS and JavaScript as one document for
 * an iframe's `srcdoc`. The same function builds what the content gate loads into jsdom,
 * so the gate checks the page the learner sees.
 *
 * Everything the playground adds carries `data-understory`, which the probe leaves out of
 * checks and of the tree: the learner sees their own page, not the scaffolding.
 */

export interface PlaygroundSources {
  html?: string;
  css?: string;
  js?: string;
  /** A React component file. Building a page with it needs `BuildOptions.react`. */
  jsx?: string;
}

export interface BuildOptions {
  /** Adds the probe, which reports checks and the tree to the parent under this nonce. */
  probe?: { nonce: string; checks: readonly PlaygroundCheck[] };
  /**
   * For a page with `jsx`: the React runtime's text and the component, transpiled by the
   * caller (core has no transpiler of its own; see `compileComponent`).
   */
  react?: { runtime: string; component: ComponentModule };
}

const NONCE = /^[A-Za-z0-9]{1,64}$/;

/** A whole document rather than a fragment: it has a doctype or its own html, head or body. */
export function isFullDocument(html: string): boolean {
  return /<!doctype\b|<(html|head|body)[\s>]/i.test(html);
}

/** Starter fields, each replaced by the override's when it has one. */
export function mergeSources(
  starter: PlaygroundSources,
  override: Partial<PlaygroundSources>,
): PlaygroundSources {
  const merged: PlaygroundSources = {};
  for (const field of ['html', 'css', 'js', 'jsx'] as const) {
    const value = override[field] ?? starter[field];
    if (value !== undefined) merged[field] = value;
  }
  return merged;
}

/**
 * The page's own policy, on top of the app's, which a srcdoc document inherits. No
 * network at all, so a lesson works offline and a page cannot send anything anywhere.
 * Scripts run only when the step has JavaScript; otherwise only the probe runs, by nonce.
 */
function policy(hasJs: boolean, nonce: string | undefined): string {
  const scripts = hasJs ? "'unsafe-inline'" : nonce ? `'nonce-${nonce}'` : "'none'";
  return [
    "default-src 'none'",
    `script-src ${scripts}`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'media-src data: blob:',
    'font-src data:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * Text inside a raw-text element cannot contain its own end tag; `<\/` reads the same.
 * In a script, `<!--` would also switch the parser into a state where a later `<script`
 * swallows the end tag; `<\!--` reads the same to JavaScript.
 */
const guard = (text: string, tag: 'script' | 'style'): string => {
  const ended = text.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');
  return tag === 'script' ? ended.replace(/<!--/g, '<\\!--') : ended;
};

/** JSON that is safe inside a script element: `<` never appears literally. */
const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

/** The frame script of a React page: it mounts the component, and reports when probed. */
function reactScript(sources: PlaygroundSources, options: BuildOptions): string {
  const component = options.react?.component ?? { error: 'no component' };
  const lines = 'code' in component ? component.code.split('\n').length : 0;
  const script = reactFrameScript(
    options.probe?.nonce ?? null,
    scriptJson(options.probe?.checks ?? []),
    lines,
    compileErrorText(component),
  );
  const nonce = options.probe ? ` nonce="${options.probe.nonce}"` : '';
  return `<script data-understory${nonce}>${script}</script>`;
}

function headInjection(sources: PlaygroundSources, options: BuildOptions): string {
  const isReact = sources.jsx !== undefined;
  const hasJs = sources.js !== undefined || isReact;
  const nonce = options.probe?.nonce;
  if (nonce !== undefined && !NONCE.test(nonce)) {
    throw new Error('buildPlaygroundDocument: a nonce is 1 to 64 letters and digits.');
  }
  const parts = [
    `<meta data-understory http-equiv="Content-Security-Policy" content="${policy(hasJs, nonce)}">`,
  ];
  if (isReact) {
    parts.push(reactScript(sources, options));
  } else if (options.probe) {
    const script = frameScript(options.probe.nonce, scriptJson(options.probe.checks));
    parts.push(`<script data-understory nonce="${options.probe.nonce}">${script}</script>`);
  }
  // The browser's own page ground. Without it the frame is see-through in a light app and
  // opaque in a dark one. Zero specificity, first in the head: any rule of the learner wins.
  parts.push('<style data-understory>:where(html){background-color:Canvas}</style>');
  if (sources.css !== undefined) {
    parts.push(`<style data-understory>${guard(sources.css, 'style')}</style>`);
  }
  return parts.join('');
}

function insertAfter(html: string, pattern: RegExp, text: string): string | null {
  const match = pattern.exec(html);
  if (!match) return null;
  const end = match.index + match[0].length;
  return html.slice(0, end) + text + html.slice(end);
}

function insertBeforeLast(html: string, pattern: RegExp, text: string): string | null {
  const matches = [...html.matchAll(pattern)];
  const last = matches[matches.length - 1];
  if (!last) return null;
  return html.slice(0, last.index) + text + html.slice(last.index);
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

const HAS_ROOT = new RegExp(`\\sid\\s*=\\s*["']?${REACT_ROOT_ID}["'\\s>]`, 'i');

/**
 * What goes at the end of the body: the JavaScript tab, or for a React page the element
 * it renders into, the runtime and the learner's module. Returns the scripts and the text
 * right before the learner's first line, to find that line in the page.
 */
function bodyEnd(sources: PlaygroundSources, options: BuildOptions): { end: string; lead: string } {
  if (sources.jsx === undefined) {
    if (sources.js === undefined) return { end: '', lead: '' };
    const lead = '<script data-understory>';
    return { end: `${lead}${guard(sources.js, 'script')}</script>`, lead };
  }
  if (!options.react) {
    throw new Error('buildPlaygroundDocument: a page with jsx needs options.react.');
  }
  const { runtime, component } = options.react;
  const root = HAS_ROOT.test(sources.html ?? '') ? '' : `<div id="${REACT_ROOT_ID}"></div>`;
  const runtimeScript = `<script data-understory>${guard(runtime, 'script')}</script>`;
  if (!('code' in component)) return { end: root + runtimeScript, lead: '' };
  const lead = `<script data-understory>${MODULE_PREFIX}`;
  const moduleScript = `${lead}${guard(component.code, 'script')}\n};</script>`;
  return { end: root + runtimeScript + moduleScript, lead };
}

/** One document for the preview frame (or for jsdom in the gate). */
export function buildPlaygroundDocument(
  sources: PlaygroundSources,
  options: BuildOptions = {},
): string {
  const head = headInjection(sources, options);
  const { end, lead } = bodyEnd(sources, options);
  const html = sources.html ?? '';

  let doc: string;
  if (isFullDocument(html)) {
    const withHead =
      insertAfter(html, /<head(\s[^>]*)?>/i, head) ??
      insertAfter(html, /<html(\s[^>]*)?>/i, head) ??
      head + html;
    doc = insertBeforeLast(withHead, /<\/body\s*>/gi, end) ?? withHead + end;
  } else {
    // A fragment has no title of its own, and axe flags a document without one.
    doc = `<!doctype html><html lang="en"><head><title data-understory>Preview</title>${head}</head><body>${html}${end}</body></html>`;
  }

  if (!options.probe && sources.jsx === undefined) return doc;
  // The line where the learner's script starts, so an error names the learner's line.
  const start = lead === '' ? 0 : lineOf(doc, doc.lastIndexOf(lead) + lead.length);
  return doc.replace(LINE_PLACEHOLDER, `"${String(start).padStart(7, '0')}"`);
}
