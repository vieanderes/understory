import { imageType } from './type.solution';

test('a PNG is recognised by its first bytes', () => {
  expect(imageType([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])).toBe('png');
});

test('a JPEG is recognised by its first bytes', () => {
  expect(imageType([255, 216, 255, 224, 0, 16])).toBe('jpeg');
});

test('an HTML page renamed to photo.png is refused', () => {
  // "<html>" as bytes
  expect(imageType([60, 104, 116, 109, 108, 62])).toBe(null);
});

test('a file shorter than any signature is refused', () => {
  expect(imageType([137, 80])).toBe(null);
  expect(imageType([])).toBe(null);
});
