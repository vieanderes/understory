'use client';

import { useMarkEditionRead } from './useNewsRead';

/** Renders nothing: opening a day page records that the edition was read. */
export function MarkEditionRead({ date }: { date: string }) {
  useMarkEditionRead(date);
  return null;
}
