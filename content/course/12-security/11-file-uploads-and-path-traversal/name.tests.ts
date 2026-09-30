import { isSafeFileName } from './name.solution';

test('plain names with an allowed extension pass', () => {
  expect(isSafeFileName('invoice-2026.pdf')).toBe(true);
  expect(isSafeFileName('floor-plan.png')).toBe(true);
});

test('a name that climbs out of the folder is refused', () => {
  expect(isSafeFileName('../.env')).toBe(false);
  expect(isSafeFileName('../../app/config.pdf')).toBe(false);
});

test('a slash is refused, so no other folder can be named', () => {
  expect(isSafeFileName('private/keys.pdf')).toBe(false);
});

test('a second extension is refused', () => {
  expect(isSafeFileName('photo.png.html')).toBe(false);
});

test('an extension outside the list is refused', () => {
  expect(isSafeFileName('page.html')).toBe(false);
  expect(isSafeFileName('invoice.PDF')).toBe(false);
});

test('an empty name is refused', () => {
  expect(isSafeFileName('')).toBe(false);
  expect(isSafeFileName('.pdf')).toBe(false);
});
