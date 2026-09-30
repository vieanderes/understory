import { z } from 'zod';
import { allLessons, allModules } from './catalog';
import type { IdsLock, RawCatalog } from './catalog';
import { withFallbacks } from './fields';

/*
 * `content/ids.lock.json` remembers every id that has shipped. Progress events point at
 * ids, so the validator refuses an id that vanishes (orphaned history) and an id that
 * returns after being retired (history attached to the wrong thing).
 */

export const idsLockSchema = z.strictObject({
  schema: z.literal(1),
  published: z.array(z.string()),
  retired: z.array(z.string()),
});

const EMPTY_LOCK: IdsLock = { schema: 1, published: [], retired: [] };

const sortedUnique = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

/**
 * Ids carry a namespace because a lesson and a concept may share a name (`js.closures`),
 * and step and card ids are only unique inside their lesson.
 */
export function catalogIds(catalog: RawCatalog): string[] {
  const concepts = allModules(catalog).flatMap((module) =>
    module.data.concepts.map((concept) => `concept:${concept.id}`),
  );
  const lessons = allLessons(catalog).flatMap(({ lesson }) => [
    `lesson:${lesson.data.id}`,
    ...withFallbacks(lesson.data.steps).map((step) => `step:${lesson.data.id}/${step.id}`),
    ...lesson.data.recall.map((card) => `card:${lesson.data.id}/${card.id}`),
  ]);
  return sortedUnique([...concepts, ...lessons]);
}

/**
 * The lock after publishing this catalog. `published` only ever grows. Retiring an id is
 * a decision an author makes by hand, so `retired` is carried over untouched.
 */
export function nextLock(catalog: RawCatalog, lock: IdsLock | undefined): IdsLock {
  const previous = lock ?? EMPTY_LOCK;
  return {
    schema: 1,
    published: sortedUnique([...previous.published, ...catalogIds(catalog)]),
    retired: sortedUnique(previous.retired),
  };
}

export interface LockDiff {
  /** Published, no longer in the content, and not retired. */
  removed: string[];
  /** Retired, yet present in the content again. */
  reused: string[];
  /** In the content but not yet in the lock. */
  unpublished: string[];
}

export function diffLock(catalog: RawCatalog, lock: IdsLock | undefined): LockDiff {
  const previous = lock ?? EMPTY_LOCK;
  const current = new Set(catalogIds(catalog));
  const retired = new Set(previous.retired);
  const published = new Set(previous.published);
  return {
    removed: previous.published.filter((id) => !current.has(id) && !retired.has(id)),
    reused: previous.retired.filter((id) => current.has(id)),
    unpublished: [...current].filter((id) => !published.has(id) && !retired.has(id)),
  };
}
