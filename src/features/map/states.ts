import type { MasteryState } from '@/core/mastery';

/** State is carried by type weight and one accent. There is no palette of badge colours. */
export const STATE_STYLE: Record<MasteryState, string> = {
  unseen: 'text-faint font-normal',
  assumed: 'text-muted font-normal',
  introduced: 'text-muted font-normal',
  practised: 'text-fg font-normal',
  solid: 'text-fg font-medium',
  fluent: 'text-fg font-semibold',
  gap: 'text-accent font-medium',
};

/**
 * The atlas draws each concept as one cell. Lightness stands in for weight: an outline for
 * assumed, then faint, muted and ink as recall firms up, and the accent for a gap.
 */
export const CELL_STYLE: Record<MasteryState, string> = {
  unseen: 'bg-border',
  assumed: 'border border-faint',
  introduced: 'bg-faint',
  practised: 'bg-faint',
  solid: 'bg-muted',
  fluent: 'bg-fg',
  gap: 'bg-accent',
};

export const STATE_LABEL: Record<MasteryState, string> = {
  unseen: 'Unseen',
  assumed: 'Assumed',
  introduced: 'Introduced',
  practised: 'Practised',
  solid: 'Solid',
  fluent: 'Fluent',
  gap: 'Gap',
};

/** The states the legend names, lightest first. */
export const LEGEND = ['unseen', 'assumed', 'practised', 'solid', 'fluent', 'gap'] as const;

export const STATE_NOTE: Record<(typeof LEGEND)[number], string> = {
  unseen: 'Not met yet',
  assumed: 'Placement says you know it',
  practised: 'Met and practised',
  solid: 'Mastery at 70% or more',
  fluent: '85% or more, and holds three weeks',
  gap: 'Was solid, now under 60%',
};
