import { Fragment, type ReactNode } from 'react';

/** Splits a string on backticks: odd parts are code. Shared with <Title>, which needs nodes. */
export function codeSpans(text: string): ReactNode[] {
  return text
    .split('`')
    .map((part, i) =>
      i % 2 === 1 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>,
    );
}

/**
 * Titles and objectives are plain strings that may mark code with backticks. This renders
 * those spans as <code> and nothing else: no markdown parser ships for one convention.
 */
export function InlineCode({ text }: { text: string }) {
  return <span className="rich-inline">{codeSpans(text)}</span>;
}
