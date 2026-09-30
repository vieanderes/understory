import { applyProfileUpdate, type User } from './solution';

const member: User = { id: 7, name: 'Priya', bio: 'Bakes bread', role: 'member' };

test('a new name and bio are saved', () => {
  const updated = applyProfileUpdate(member, { name: 'Priya S', bio: 'Bakes cakes' });
  expect(updated.name).toBe('Priya S');
  expect(updated.bio).toBe('Bakes cakes');
});

test('a role sent in the body is ignored', () => {
  expect(applyProfileUpdate(member, { role: 'admin' }).role).toBe('member');
});

test('an id sent in the body is ignored', () => {
  expect(applyProfileUpdate(member, { id: 1 }).id).toBe(7);
});

test('a field left out keeps its old value', () => {
  expect(applyProfileUpdate(member, { name: 'P' }).bio).toBe('Bakes bread');
});

test('an unknown field is not added', () => {
  const updated = applyProfileUpdate(member, { isVerified: true });
  expect(Object.keys(updated).sort()).toEqual(['bio', 'id', 'name', 'role']);
});

test('the stored user is not changed in place', () => {
  applyProfileUpdate(member, { name: 'Changed' });
  expect(member.name).toBe('Priya');
});
