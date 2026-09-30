import { Fragment } from 'react';
import { cn } from '@/lib/cn';

/**
 * A few lesson fields stay plain strings in the bundle (rubric points, subgoal labels,
 * the request of an ai-review) yet authors write `code` in them. Backticks are the only
 * markdown they may hold, so a split is enough and no parser ships to the browser.
 */
export function InlineMd({ text, className }: { text: string; className?: string }) {
  const parts = text.split('`');
  return (
    <span className={cn('rich-inline', className)}>
      {parts.map((part, i) =>
        // Odd parts sat between two backticks. An unclosed backtick stays literal.
        i % 2 === 1 && i < parts.length - 1 ? (
          <code key={i}>{part}</code>
        ) : (
          <Fragment key={i}>{i % 2 === 1 ? `\`${part}` : part}</Fragment>
        ),
      )}
    </span>
  );
}
