import { cn } from '@/lib/cn';

/**
 * The code of one Parsons block. The compiler emits `<pre tabindex="0">`, which is right
 * for a scrolling listing and wrong here: a block wraps instead of scrolling, a <pre> may
 * not sit inside a <button>, and a tab stop per block would bury the real controls. So
 * the outer tag becomes a span and `.block-code` restores the preformatted look.
 */
export function BlockCode({ html, className }: { html: string; className?: string }) {
  const inner = html.replace(/^<pre[^>]*>/, '').replace(/<\/pre>\s*$/, '');
  return (
    <span className={cn('block-code', className)} dangerouslySetInnerHTML={{ __html: inner }} />
  );
}
