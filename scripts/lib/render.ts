import { Marked } from 'marked';
import { createCssVariablesTheme, createHighlighter } from 'shiki';
import type { Highlighter } from 'shiki';
import { hangOf } from '../../src/core/content/indent';
import type { Language } from '../../src/core/content/schema';

/*
 * Markdown and code to HTML, at build time only. Nothing here reaches the browser: the
 * bundle carries the finished HTML, which is why a phone needs no highlighter.
 */

export interface Renderer {
  /** Block markdown: paragraphs, lists, fences. */
  markdown(md: string): string;
  /** One line of inline markdown, with no wrapping paragraph. */
  inline(md: string): string;
  code(code: string, language: Language): string;
}

const THEME_NAME = 'understory';

/**
 * Colours are CSS variables (`--shiki-token-keyword` and so on), set from the design
 * tokens in the stylesheet. No defaults are given, so no colour literal can reach the
 * bundle, and light and dark mode need no second render.
 */
const theme = createCssVariablesTheme({
  name: THEME_NAME,
  variablePrefix: '--shiki-',
  variableDefaults: {},
  fontStyle: true,
});

// Creating a highlighter loads the regex engine and the grammars, which is the slow part
// of a build. One instance serves every renderer and gains languages as they are needed.
let shared: Promise<Highlighter> | undefined;

async function highlighterFor(languages: readonly Language[]): Promise<Highlighter> {
  shared ??= createHighlighter({ themes: [theme], langs: [] });
  const highlighter = await shared;
  const loaded = new Set(highlighter.getLoadedLanguages());
  // `text` is built in and has no grammar to load.
  const missing = languages.filter((language) => language !== 'text' && !loaded.has(language));
  await highlighter.loadLanguage(...missing);
  return highlighter;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function createRenderer(languages: readonly Language[]): Promise<Renderer> {
  const highlighter = await highlighterFor(languages);
  const known = new Set<string>(languages);

  const code = (source: string, language: string): string => {
    const trimmed = source.replace(/\n+$/, '');
    const lines = trimmed.split('\n');
    const tabSize = language === 'python' ? 4 : 2;
    return highlighter.codeToHtml(trimmed, {
      lang: known.has(language) ? language : 'text',
      theme: THEME_NAME,
      // Shiki stops tokenising a line after 500 ms by default and emits the rest as plain
      // text, so a build on a busy machine gave different HTML. Lesson code is short and
      // trusted, so the build waits instead: the output must not depend on machine load.
      tokenizeTimeLimit: 0,
      transformers: [
        {
          // Bug-hunt and trace steps point at lines, so each line says which one it is.
          line(node, line) {
            node.properties['data-line'] = line;
            // On a phone a wrapped row hangs under the line's own code, as it does in the
            // editor (src/features/editor/hanging-indent.ts).
            node.properties.style = `--hang:${hangOf(lines[line - 1] ?? '', tabSize)}ch`;
          },
        },
      ],
    });
  };

  const marked = new Marked({
    gfm: true,
    renderer: {
      // The validator rejects raw HTML. Escaping it here as well means a missed case
      // shows up as visible text, never as live markup.
      html: ({ text }) => escapeHtml(text),
      code: ({ text, lang }) => code(text, (lang ?? '').trim().split(/\s+/)[0] ?? ''),
    },
  });

  return {
    markdown: (md) => marked.parse(md, { async: false }),
    inline: (md) => marked.parseInline(md, { async: false }),
    code,
  };
}
