import { describe, expect, it } from 'vitest';
import { hangOf, leadingColumns } from '@/core/content/indent';

describe('leadingColumns', () => {
  it('counts spaces, and a tab to the next stop', () => {
    expect(leadingColumns('return 1;', 2)).toBe(0);
    expect(leadingColumns('    x', 2)).toBe(4);
    expect(leadingColumns('\tx', 4)).toBe(4);
    expect(leadingColumns(' \tx', 4)).toBe(4);
    expect(leadingColumns('  \t x', 2)).toBe(5);
  });

  it('is the whole length of a blank line', () => {
    expect(leadingColumns('   ', 2)).toBe(3);
  });
});

describe('hangOf', () => {
  it('sits two columns past the line indent', () => {
    expect(hangOf('  // a long comment', 2)).toBe(4);
    expect(hangOf('x', 4)).toBe(2);
  });
});
