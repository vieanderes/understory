import { describe, expect, it } from 'vitest';
import { recallAtK, reciprocalRank } from '../src/metrics';

describe('recallAtK', () => {
  it('is the share of relevant documents in the first k', () => {
    expect(recallAtK(['a', 'b', 'c'], ['a', 'c'], 3)).toBe(1);
    expect(recallAtK(['a', 'b', 'c'], ['a', 'c'], 2)).toBe(0.5);
    expect(recallAtK(['x', 'y'], ['a'], 2)).toBe(0);
  });

  it('counts a document once even when several of its chunks are retrieved', () => {
    expect(recallAtK(['a', 'a', 'a', 'b'], ['b'], 2)).toBe(1);
  });
});

describe('reciprocalRank', () => {
  it('is one over the rank of the first relevant document', () => {
    expect(reciprocalRank(['a', 'b'], ['a'])).toBe(1);
    expect(reciprocalRank(['x', 'y', 'a'], ['a', 'y'])).toBe(0.5);
    expect(reciprocalRank(['x', 'x', 'a'], ['a'])).toBe(0.5);
    expect(reciprocalRank(['x'], ['a'])).toBe(0);
  });
});
