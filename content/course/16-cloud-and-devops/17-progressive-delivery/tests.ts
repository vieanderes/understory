import { bucketFor } from './solution';

const users = Array.from({ length: 10_000 }, (_, i) => `user-${i}`);

test('a user gets the same answer on every call', () => {
  for (const user of users.slice(0, 200)) {
    const first = bucketFor(user, 'new-checkout', 10);
    for (let call = 0; call < 10; call++) {
      expect(bucketFor(user, 'new-checkout', 10)).toBe(first);
    }
  }
});

test('about 10% of users are in a 10% rollout', () => {
  const inside = users.filter((user) => bucketFor(user, 'new-checkout', 10)).length;
  expect(inside > 800 && inside < 1200).toBeTruthy();
});

test('0% lets nobody in and 100% lets everyone in', () => {
  expect(users.some((user) => bucketFor(user, 'new-checkout', 0))).toBe(false);
  expect(users.every((user) => bucketFor(user, 'new-checkout', 100))).toBe(true);
});

test('raising 10% to 20% keeps everyone who was already in', () => {
  const kept = users.filter((user) => bucketFor(user, 'new-checkout', 10));
  expect(kept.every((user) => bucketFor(user, 'new-checkout', 20))).toBe(true);
});

test('another flag picks a different group of users', () => {
  const checkout = users.filter((user) => bucketFor(user, 'new-checkout', 10));
  const search = users.filter((user) => bucketFor(user, 'new-search', 10));
  expect(checkout).not.toEqual(search);
});
