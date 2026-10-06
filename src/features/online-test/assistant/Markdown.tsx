'use client';

import { javascriptLanguage, typescriptLanguage } from '@codemirror/lang-javascript';
import { pythonLanguage } from '@codemirror/lang-python';
import { classHighlighter, highlightTree } from '@lezer/highlight';
import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

/*
 * The assistant's replies, as Markdown. Built into React elements, never set as HTML: the
 * text comes from a model, so nothing in it may become markup. The subset a coding tutor
 * needs: paragraphs, headings, lists, quotes, inline code, bold, italic, links and fenced
 * code, highlighted with the editor's own grammars and a copy button.
 */

/** Where in-app links go when a reply may use them: Scout's directions, never a test. */
export interface InAppLinks {
  /** Called when one is followed, so a sheet covering the page can get out of the way. */
  onFollow?: () => void;
}

const BASE = 'https://understory.invalid';

/**
 * A model's relative link as a path in this app, or null. Only a single leading slash
 * counts: `//host` and `/\host` are other sites to a browser, and a scheme never matches.
 */
export function inAppHref(href: string): string | null {
  if (!/^\/(?![/\\])/.test(href) || /[\\\s\p{Cc}]/u.test(href)) return null;
  try {
    const url = new URL(href, BASE);
    if (url.origin !== BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

const PARSERS = {
  js: javascriptLanguage.parser,
  javascript: javascriptLanguage.parser,
  jsx: javascriptLanguage.parser,
  ts: typescriptLanguage.parser,
  typescript: typescriptLanguage.parser,
  tsx: typescriptLanguage.parser,
  py: pythonLanguage.parser,
  python: pythonLanguage.parser,
} as const;

function highlighted(code: string, language: string): ReactNode[] {
  const parser = PARSERS[language.toLowerCase() as keyof typeof PARSERS];
  if (!parser) return [code];
  const out: ReactNode[] = [];
  let at = 0;
  highlightTree(parser.parse(code), classHighlighter, (from, to, classes) => {
    if (from > at) out.push(code.slice(at, from));
    out.push(
      <span key={from} className={classes}>
        {code.slice(from, to)}
      </span>,
    );
    at = to;
  });
  if (at < code.length) out.push(code.slice(at));
  return out;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-sunken border-border rounded-control group relative my-1 border">
      <div className="text-faint flex items-center justify-between px-1 pt-0.5 text-sm">
        <span className="font-mono">{language || 'code'}</span>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true))}
          onBlur={() => setCopied(false)}
          aria-label="Copy the code"
          title="Copy"
          className="hover:text-fg rounded-inner inline-flex size-4 items-center justify-center"
        >
          {copied ? (
            <Check aria-hidden size={16} strokeWidth={2} />
          ) : (
            <Copy aria-hidden size={16} strokeWidth={2} />
          )}
        </button>
      </div>
      <pre
        tabIndex={0}
        aria-label={`${language || 'Code'} example`}
        className="overflow-x-auto px-1 pb-1 font-mono text-sm"
      >
        <code>{highlighted(code, language)}</code>
      </pre>
    </div>
  );
}

/** Inline spans: code first, so nothing inside backticks is read as emphasis or a link. */
function inline(text: string, key: string, links?: InAppLinks): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\))/g;
  let at = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > at) out.push(text.slice(at, match.index));
    const token = match[0];
    const k = `${key}-${n++}`;
    if (match[1]) {
      out.push(
        <code key={k} className="bg-sunken rounded-inner px-0.5 font-mono text-sm">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) out.push(<strong key={k}>{token.slice(2, -2)}</strong>);
    else if (match[3]) out.push(<em key={k}>{token.slice(1, -1)}</em>);
    else if (match[4] && match[5] && !/^https?:/.test(match[5])) {
      // A path in the app: followed in place, or left as plain words where links may not go.
      const label = token.slice(1, token.indexOf(']('));
      const href = links ? inAppHref(match[5]) : null;
      out.push(
        href ? (
          <Link
            key={k}
            href={href}
            onClick={() => links?.onFollow?.()}
            className="underline underline-offset-4"
          >
            {label}
          </Link>
        ) : (
          token
        ),
      );
    } else if (match[4] && match[5]) {
      const label = token.slice(1, token.indexOf(']('));
      out.push(
        <a
          key={k}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {label}
        </a>,
      );
    }
    at = match.index + token.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

type Block =
  | { kind: 'code'; language: string; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'paragraph'; text: string };

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const fence = /^\s*```\s*([\w+#-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      // An unclosed fence, as while a reply is still streaming, runs to the end.
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i] ?? '')) body.push(lines[i++] ?? '');
      i += 1;
      blocks.push({ kind: 'code', language: fence[1] ?? '', text: body.join('\n') });
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2] ?? '' });
      i += 1;
      continue;
    }
    const bullet = /^\s*([-*]|\d+[.)])\s+/;
    if (bullet.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(bullet, ''));
        i += 1;
        // A wrapped item continues on indented lines.
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i] ?? '') &&
          !bullet.test(lines[i] ?? '')
        ) {
          items[items.length - 1] += ` ${(lines[i] ?? '').trim()}`;
          i += 1;
        }
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>'))
        quote.push((lines[i++] ?? '').replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: quote.join(' ') });
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^\s*```/.test(lines[i] ?? '') &&
      !/^#{1,4}\s/.test(lines[i] ?? '') &&
      !bullet.test(lines[i] ?? '')
    ) {
      paragraph.push(lines[i++] ?? '');
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

export function Markdown({ text, links }: { text: string; links?: InAppLinks }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {parseBlocks(text).map((block, i) => {
        const key = String(i);
        switch (block.kind) {
          case 'code':
            return <CodeBlock key={key} code={block.text} language={block.language} />;
          case 'heading':
            return (
              <p key={key} className="pt-0.5 font-semibold">
                {inline(block.text, key, links)}
              </p>
            );
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul';
            return (
              <List key={key} className={block.ordered ? 'list-decimal pl-3' : 'list-disc pl-3'}>
                {block.items.map((item, j) => (
                  <li key={j} className="pl-0.5">
                    {inline(item, `${key}-${j}`, links)}
                  </li>
                ))}
              </List>
            );
          }
          case 'quote':
            return (
              <blockquote key={key} className="border-border text-muted border-l-2 pl-1">
                {inline(block.text, key, links)}
              </blockquote>
            );
          case 'paragraph':
            return <p key={key}>{inline(block.text, key, links)}</p>;
        }
      })}
    </div>
  );
}
