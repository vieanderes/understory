import { csrfOk } from './solution';

test('a POST with the matching token is allowed', () => {
  expect(csrfOk('POST', 'q8Fz1xA', 'q8Fz1xA')).toBe(true);
});

test('a POST with no token is refused', () => {
  expect(csrfOk('POST', undefined, 'q8Fz1xA')).toBe(false);
});

test('a POST with the wrong token is refused', () => {
  expect(csrfOk('POST', 'guess123', 'q8Fz1xA')).toBe(false);
});

test('a GET needs no token', () => {
  expect(csrfOk('GET', undefined, 'q8Fz1xA')).toBe(true);
});

test('two missing tokens are not a match', () => {
  expect(csrfOk('DELETE', undefined, undefined)).toBe(false);
});

test('two empty tokens are not a match', () => {
  expect(csrfOk('POST', '', '')).toBe(false);
});
