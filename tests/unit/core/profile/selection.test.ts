import { describe, expect, it } from 'vitest';
import { coverage, toggleGroup } from '@/core/profile';

describe('selection', () => {
  const chapter = ['a.1', 'a.2', 'a.3'];

  it('says whether a group is fully, partly or not chosen', () => {
    expect(coverage(chapter, new Set())).toBe('none');
    expect(coverage(chapter, new Set(['a.2']))).toBe('some');
    expect(coverage(chapter, new Set(chapter))).toBe('all');
    expect(coverage([], new Set(['a.1']))).toBe('none');
  });

  it('chooses a whole group, or clears it when it is all chosen', () => {
    const some = toggleGroup(new Set(['a.2', 'b.1']), chapter);
    expect([...some].sort()).toEqual(['a.1', 'a.2', 'a.3', 'b.1']);
    const cleared = toggleGroup(some, chapter);
    expect([...cleared]).toEqual(['b.1']);
  });

  it('does not change the set it was given', () => {
    const before = new Set(['b.1']);
    toggleGroup(before, chapter);
    expect([...before]).toEqual(['b.1']);
  });
});
