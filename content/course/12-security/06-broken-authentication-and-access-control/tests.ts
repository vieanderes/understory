import { checkResetToken } from './solution';

test('a fresh, unused token is ok', () => {
  expect(checkResetToken({ email: 'a@x.io', expiresAt: 100, usedAt: null }, 50)).toBe('ok');
});

test('a token past its expiry is expired', () => {
  expect(checkResetToken({ email: 'a@x.io', expiresAt: 100, usedAt: null }, 100)).toBe('expired');
});

test('a token already used is used, even before expiry', () => {
  expect(checkResetToken({ email: 'a@x.io', expiresAt: 100, usedAt: 40 }, 50)).toBe('used');
});

test('a used check wins over an expired one', () => {
  expect(checkResetToken({ email: 'a@x.io', expiresAt: 100, usedAt: 40 }, 200)).toBe('used');
});

test('an unknown token is unknown', () => {
  expect(checkResetToken(null, 50)).toBe('unknown');
});
