import type { Rich } from '@/core/content/compiled';
import { cn } from '@/lib/cn';

/**
 * Lesson text. The HTML was produced from the author's markdown at build time by our own
 * compiler with raw HTML disabled, so it is trusted input, not user input.
 */
export function RichText({
  value,
  inline,
  className,
}: {
  value: Rich;
  inline?: boolean;
  className?: string;
}) {
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag
      className={cn(inline ? 'rich-inline' : 'rich', className)}
      dangerouslySetInnerHTML={{ __html: value.html }}
    />
  );
}
