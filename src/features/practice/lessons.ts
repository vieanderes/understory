import type { CompiledLesson } from '@/core/content/compiled';
import type { CatalogFile } from '@/core/practice';

/** Compiled lessons are immutable files with a hash in their name, so one fetch each. */
const cache = new Map<string, Promise<CompiledLesson>>();

export function loadLesson(catalog: CatalogFile, lessonId: string): Promise<CompiledLesson> {
  const entry = catalog.lessons[lessonId];
  if (!entry) return Promise.reject(new Error(`The course index has no lesson "${lessonId}".`));
  let pending = cache.get(entry.file);
  if (!pending) {
    pending = fetch(`/content/v1/${entry.file}`).then((response) => {
      if (!response.ok) throw new Error(`${entry.file}: ${response.status}`);
      return response.json() as Promise<CompiledLesson>;
    });
    // A failed fetch must not poison the cache: the next item may succeed once online.
    pending.catch(() => cache.delete(entry.file));
    cache.set(entry.file, pending);
  }
  return pending;
}

/** `lesson:js.closures#card-1` to its parts. */
export function parseCardKey(
  cardKey: string,
): { kind: 'lesson' | 'skill'; lessonId: string; id: string } | null {
  const match = /^(lesson|skill):([^#]+)#(.+)$/.exec(cardKey);
  if (!match) return null;
  return { kind: match[1] as 'lesson' | 'skill', lessonId: match[2] ?? '', id: match[3] ?? '' };
}
