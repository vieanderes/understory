/** A lesson's place on each path that lists it: where to go next, and where to return. */
export interface LessonOnPath {
  id: string;
  name: string;
  next: { href: string; title: string } | null;
}

/** A lesson link that remembers which path it was opened from. */
export function onPath(href: string, pathId: string): string {
  return `${href}?path=${encodeURIComponent(pathId)}`;
}
