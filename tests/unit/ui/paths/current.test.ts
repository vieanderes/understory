import { describe, expect, it } from 'vitest';
import { chosenPathIds, chosenPaths, currentPath, togglePath } from '@/features/paths/current';
import type { PathSummary } from '@/lib/content';

const path = (id: string, lessonIds: string[]): PathSummary => ({
  id,
  name: id,
  title: id,
  promise: '',
  summary: '',
  outcomes: [],
  method: [],
  shapes: [],
  practice: [],
  readyWhen: [],
  stages: [],
  lessonIds,
  minutes: 0,
});
const paths = [path('python', ['py.1', 'py.2']), path('algo', ['al.1']), path('ts', ['ts.1'])];
const noPlan = { progress: undefined };

describe('chosen paths', () => {
  it('reads one or several path ids, in the order they were chosen', () => {
    expect(chosenPathIds('python')).toEqual(['python']);
    expect(chosenPathIds('algo,python')).toEqual(['algo', 'python']);
    expect(chosenPathIds(undefined)).toEqual([]);
    expect(chosenPathIds(3)).toEqual([]);
  });

  it('adds a path at the end, or removes it, keeping the order', () => {
    expect(togglePath(['python'], 'algo')).toBe('python,algo');
    expect(togglePath(['python', 'algo'], 'python')).toBe('algo');
  });

  it('keeps only paths that exist', () => {
    expect(chosenPaths(paths, 'gone,algo').map((p) => p.id)).toEqual(['algo']);
  });

  it('is on the first chosen path that is not finished', () => {
    const done = new Set(['al.1']);
    expect(currentPath(paths, noPlan, (id) => done.has(id), 'algo,python')?.id).toBe('python');
    // Everything chosen done: stay on the first, rather than jumping somewhere unasked.
    expect(currentPath(paths, noPlan, () => true, 'algo,python')?.id).toBe('algo');
  });
});
