import { describe, expect, it } from 'vitest';
import { lockedFrame, locateRegion, parseLineRange } from '@/core/content/editable';

const STARTER = [
  'function cartTotal(lines) {',
  '  let total = 0;',
  '  // Add each line here.',
  '  return total;',
  '}',
  '',
].join('\n');

describe('parseLineRange', () => {
  it('reads a range and a single line', () => {
    expect(parseLineRange('3-5')).toEqual({ first: 3, last: 5 });
    expect(parseLineRange('3')).toEqual({ first: 3, last: 3 });
  });

  it('refuses what is not a forward range of line numbers', () => {
    for (const text of ['', '0', '0-2', '5-3', 'a-b', '3-', '-3', ' 3-5', '3 - 5', '3-5-7']) {
      expect(parseLineRange(text), text).toBeNull();
    }
  });
});

describe('lockedFrame', () => {
  it('keeps the lines before and after the range, with their line breaks', () => {
    expect(lockedFrame(STARTER, { first: 3, last: 3 })).toEqual({
      head: 'function cartTotal(lines) {\n  let total = 0;\n',
      tail: '\n  return total;\n}\n',
    });
  });

  it('has an empty head or tail when the range starts or ends the file', () => {
    expect(lockedFrame('a\nb\nc', { first: 1, last: 2 })).toEqual({ head: '', tail: '\nc' });
    expect(lockedFrame('a\nb\nc', { first: 2, last: 3 })).toEqual({ head: 'a\n', tail: '' });
  });

  it('is null for a range past the last line', () => {
    expect(lockedFrame('a\nb', { first: 2, last: 3 })).toBeNull();
    expect(lockedFrame('a\nb', { first: 3, last: 3 })).toBeNull();
  });
});

describe('locateRegion', () => {
  const frame = lockedFrame(STARTER, { first: 3, last: 3 });
  if (!frame) throw new Error('fixture');

  it('finds the editable lines in the starter itself', () => {
    const region = locateRegion(STARTER, frame);
    expect(region && STARTER.slice(region.from, region.to)).toBe('  // Add each line here.');
  });

  it('follows the region as it grows to several lines', () => {
    const body = '  for (const line of lines) {\n    total += line;\n  }';
    const doc = frame.head + body + frame.tail;
    const region = locateRegion(doc, frame);
    expect(region && doc.slice(region.from, region.to)).toBe(body);
  });

  it('allows an empty region', () => {
    const doc = frame.head + frame.tail;
    expect(locateRegion(doc, frame)).toEqual({ from: frame.head.length, to: frame.head.length });
  });

  it('is null for a draft whose locked lines were changed, so it stays fully editable', () => {
    expect(locateRegion(STARTER.replace('let total', 'var total'), frame)).toBeNull();
    expect(locateRegion(STARTER.replace('return', 'yield'), frame)).toBeNull();
    // Head and tail overlap: the text is too short to hold both.
    expect(locateRegion('function', { head: 'function', tail: 'on' })).toBeNull();
  });
});
