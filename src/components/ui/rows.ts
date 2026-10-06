import { cn } from '@/lib/cn';

/*
 * Hairline rows: the list pattern Learn and Practice share. A row is a title, at most one
 * muted line and a quiet figure or arrow on the right, separated from its neighbours by a
 * 1 px rule rather than a box. Two columns on wide screens, one on a phone.
 */

/** The list: rows in one column, two from `lg`, where the column is wide enough. */
export const rowList = (className?: string) =>
  cn('grid grid-cols-1 gap-x-4 lg:grid-cols-2', className);

/** One cell of the list: the rule above it. */
export const rowItem = 'border-border border-t';

/**
 * The pressable row inside a cell. It reaches 4 px past the text on both sides, so the
 * hover fill has room to breathe while the text stays on the column edge.
 */
export const rowAction = (className?: string) =>
  cn(
    'group rounded-control transition-press -mx-0.5 flex min-h-6 w-full items-center gap-2 px-0.5 py-1.5 text-left select-none',
    'hover:bg-raised active:scale-98',
    className,
  );

/** The arrow at a row's end: faint at rest, ink and a 4 px nudge on hover. */
export const rowArrow =
  'text-faint group-hover:text-fg shrink-0 transition duration-150 ease-out group-hover:translate-x-0.5';
