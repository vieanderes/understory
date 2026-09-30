import { coversName } from './solution';

test('an exact name matches', () => {
  expect(coversName(['notes.test'], 'notes.test')).toBe(true);
});

test('a different host does not match', () => {
  expect(coversName(['notes.test'], 'www.notes.test')).toBe(false);
});

test('a wildcard covers one label', () => {
  expect(coversName(['*.example.com'], 'www.example.com')).toBe(true);
});

test('a wildcard does not cover the bare domain', () => {
  expect(coversName(['*.example.com'], 'example.com')).toBe(false);
});

test('a wildcard does not cover two labels', () => {
  expect(coversName(['*.example.com'], 'a.b.example.com')).toBe(false);
});

test('any name in the list may match, in any letter case', () => {
  expect(coversName(['example.com', '*.example.com'], 'EXAMPLE.com')).toBe(true);
  expect(coversName([], 'example.com')).toBe(false);
});
