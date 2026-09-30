/*
 * The editable region of a code challenge (docs/MOBILE-EDITING.md, section 8.4): the lines
 * of the starter the learner writes, with the scaffold above and below locked. On a phone
 * that is the difference between scrolling past twenty lines of setup and typing only
 * what the task is about.
 *
 * The lock is anchored on text, not on line numbers: the locked head and tail of the
 * starter must still open and close the document. A draft saved before the region
 * existed, or one whose scaffold was changed some other way, simply has no lock.
 */

/** Starter lines, counted from 1, both ends included. */
export interface LineRange {
  first: number;
  last: number;
}

/** The locked text before and after the editable lines, line breaks included. */
export interface LockedFrame {
  head: string;
  tail: string;
}

const RANGE = /^([1-9]\d*)(?:-([1-9]\d*))?$/;

/** `"5-9"` or `"5"`. Anything else, including a backwards range, is null. */
export function parseLineRange(text: string): LineRange | null {
  const match = RANGE.exec(text);
  if (!match) return null;
  const first = Number(match[1]);
  const last = match[2] === undefined ? first : Number(match[2]);
  return last >= first ? { first, last } : null;
}

/**
 * Splits the starter around the range. The head keeps the line break that ends it and
 * the tail the one that starts it, so the region between them is whole lines with no
 * break at either end. Null when the range reaches past the starter.
 */
export function lockedFrame(starter: string, range: LineRange): LockedFrame | null {
  const lines = starter.split('\n');
  if (range.last > lines.length) return null;
  const before = lines.slice(0, range.first - 1);
  const after = lines.slice(range.last);
  return {
    head: before.length > 0 ? `${before.join('\n')}\n` : '',
    tail: after.length > 0 ? `\n${after.join('\n')}` : '',
  };
}

/** Where the region sits in `doc`, or null when the locked text is no longer around it. */
export function locateRegion(
  doc: string,
  frame: LockedFrame,
): { from: number; to: number } | null {
  if (doc.length < frame.head.length + frame.tail.length) return null;
  if (!doc.startsWith(frame.head) || !doc.endsWith(frame.tail)) return null;
  return { from: frame.head.length, to: doc.length - frame.tail.length };
}
