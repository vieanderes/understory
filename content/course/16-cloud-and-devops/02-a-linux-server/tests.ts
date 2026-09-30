import { canRead, type FileInfo } from './solution';

const env: FileInfo = { owner: 'shop', group: 'shop', mode: '600' };
const log: FileInfo = { owner: 'shop', group: 'ops', mode: '640' };

test('the owner reads a 600 file', () => {
  expect(canRead(env, { name: 'shop', groups: ['shop'] })).toBe(true);
});

test('another user cannot read a 600 file', () => {
  expect(canRead(env, { name: 'guest', groups: ['guest'] })).toBe(false);
});

test('a member of the group reads a 640 file', () => {
  expect(canRead(log, { name: 'ana', groups: ['ana', 'ops'] })).toBe(true);
});

test('everyone else is refused by the last digit', () => {
  expect(canRead(log, { name: 'guest', groups: ['guest'] })).toBe(false);
});

test('the owner digit wins, even when it is lower than the others', () => {
  const odd: FileInfo = { owner: 'shop', group: 'shop', mode: '044' };
  expect(canRead(odd, { name: 'shop', groups: ['shop'] })).toBe(false);
  expect(canRead(odd, { name: 'guest', groups: [] })).toBe(true);
});

test('root reads anything', () => {
  expect(canRead({ owner: 'shop', group: 'shop', mode: '000' }, { name: 'root', groups: [] })).toBe(
    true,
  );
});
