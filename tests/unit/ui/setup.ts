import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only cleans up by itself when test globals are on. They are off here,
// so that every test file says what it imports.
afterEach(cleanup);

// jsdom has no layout, so Range has no rectangles. CodeMirror measures text in an
// animation frame that can land after a test ends; empty rectangles let it finish quietly
// instead of throwing an uncaught error into the next test.
if (typeof Range !== 'undefined') {
  const empty = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  });
  Range.prototype.getClientRects ??= (() => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  })) as never;
  Range.prototype.getBoundingClientRect ??= empty as never;
}
