import { displayName } from './greet.solution';

const MEMBERS = [
  { id: 'M-1', name: 'Ada' },
  { id: 'M-2', name: 'Grace' },
];

test('finds a member by id', () => {
  expect(displayName(MEMBERS, 'M-2')).toBe('Grace');
});

test('an unknown id gives Guest instead of crashing', () => {
  expect(displayName(MEMBERS, 'M-9')).toBe('Guest');
});

test('an empty list gives Guest', () => {
  expect(displayName([], 'M-1')).toBe('Guest');
});
