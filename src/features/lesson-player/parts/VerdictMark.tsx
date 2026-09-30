import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The mark beside one judged part of an answer (a cell, a blank, a block). An icon and a
 * hidden word, because colour alone does not reach everyone.
 */
export function VerdictMark({
  right,
  label,
  className,
}: {
  right: boolean;
  /** Read aloud in place of "Right" or "Wrong". */
  label?: string;
  className?: string;
}) {
  const Icon = right ? Check : X;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center',
        right ? 'text-success' : 'text-danger',
        className,
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={2} />
      <span className="sr-only">{label ?? (right ? 'Right' : 'Wrong')}</span>
    </span>
  );
}
