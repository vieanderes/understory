import { checkPassword, hashPassword } from './solution';

// Stand-ins for scryptSync and randomBytes, so the tests give the same answer every run.
const slowHash = (password: string, salt: string): string => `h(${salt}|${password})`;
function saltsFrom(list: string[]): () => string {
  let next = 0;
  return () => list[next++] ?? 'zz';
}

test('stores the salt, a colon, then the hash', () => {
  expect(hashPassword('sunshine', saltsFrom(['a1']), slowHash)).toBe('a1:h(a1|sunshine)');
});

test('two users with the same password get different stored strings', () => {
  const makeSalt = saltsFrom(['a1', 'b2']);
  const first = hashPassword('sunshine', makeSalt, slowHash);
  const second = hashPassword('sunshine', makeSalt, slowHash);
  expect(first).not.toBe(second);
});

test('the right password checks out', () => {
  const stored = hashPassword('sunshine', saltsFrom(['a1']), slowHash);
  expect(checkPassword(stored, 'sunshine', slowHash)).toBe(true);
});

test('a wrong password is refused', () => {
  const stored = hashPassword('sunshine', saltsFrom(['a1']), slowHash);
  expect(checkPassword(stored, 'sunshine1', slowHash)).toBe(false);
});

test('the login reuses the stored salt', () => {
  expect(checkPassword('c3:h(c3|tea)', 'tea', slowHash)).toBe(true);
});
