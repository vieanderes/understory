/*
 * Choosing lessons for a custom path: a tree of parts, chapters and lessons where a group is
 * chosen whole or opened to choose inside it. A group's state is derived from the lessons it
 * holds, so the tree never stores anything but lesson ids.
 */

export type Coverage = 'all' | 'some' | 'none';

export function coverage(ids: readonly string[], chosen: ReadonlySet<string>): Coverage {
  const count = ids.filter((id) => chosen.has(id)).length;
  if (count === 0) return 'none';
  return count === ids.length ? 'all' : 'some';
}

/** A tap on a group: a group not wholly chosen becomes chosen; a chosen one is cleared. */
export function toggleGroup(chosen: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(chosen);
  if (coverage(ids, chosen) === 'all') for (const id of ids) next.delete(id);
  else for (const id of ids) next.add(id);
  return next;
}
