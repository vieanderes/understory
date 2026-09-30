import { describe, expect, it } from 'vitest';
import { catalogIds, idsLockSchema, nextLock } from '@/core/content/lock';
import { lessonOf, stepOf, unlockedCatalog } from './fixtures';

describe('catalogIds', () => {
  it('namespaces ids, because a lesson and a concept may share a name', () => {
    const ids = catalogIds(unlockedCatalog());
    expect(ids).toContain('lesson:js.coercion');
    expect(ids).toContain('concept:js.coercion');
    expect(ids).toContain('step:js.coercion/predict-total');
    expect(ids).toContain('step:js.coercion/lab-coercion-fallback');
    expect(ids).toContain('card:js.coercion/card-1');
  });

  it('is sorted and free of duplicates', () => {
    const ids = catalogIds(unlockedCatalog());
    expect(ids).toEqual([...new Set(ids)].sort());
  });
});

describe('nextLock', () => {
  it('starts a lock from nothing', () => {
    const lock = nextLock(unlockedCatalog(), undefined);
    expect(lock.schema).toBe(1);
    expect(lock.retired).toEqual([]);
    expect(lock.published).toEqual(catalogIds(unlockedCatalog()));
  });

  it('never forgets a published id, even when the content drops it', () => {
    const before = nextLock(unlockedCatalog(), undefined);
    const catalog = unlockedCatalog();
    stepOf(lessonOf(catalog), 'prose').id = 'renamed-intro';
    const after = nextLock(catalog, { ...before, retired: ['step:js.coercion/intro'] });
    expect(after.published).toContain('step:js.coercion/intro');
    expect(after.published).toContain('step:js.coercion/renamed-intro');
    expect(after.retired).toEqual(['step:js.coercion/intro']);
  });

  it('is stable: a second run changes nothing', () => {
    const once = nextLock(unlockedCatalog(), undefined);
    expect(nextLock(unlockedCatalog(), once)).toEqual(once);
  });
});

describe('idsLockSchema', () => {
  it('rejects a lock with an unknown key', () => {
    expect(idsLockSchema.safeParse({ schema: 1, published: [], retired: [], extra: 1 }).success).toBe(
      false,
    );
  });
});
