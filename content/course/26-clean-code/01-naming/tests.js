// A user has a name and the day number of their last login.
function user(name, lastLoginDay) {
  return { name, lastLoginDay };
}

test('lists users away for more than 30 days', () => {
  const users = [user('Ana', 10), user('Ben', 95), user('Cy', 40)];
  expect(inactiveUserNames(users, 100)).toEqual(['Ana', 'Cy']);
});

test('leaves out a user away for exactly 30 days', () => {
  expect(inactiveUserNames([user('Dee', 70)], 100)).toEqual([]);
});

test('keeps the order the users came in', () => {
  const users = [user('Zoe', 1), user('Al', 2)];
  expect(inactiveUserNames(users, 100)).toEqual(['Zoe', 'Al']);
});

test('returns an empty list for no users', () => {
  expect(inactiveUserNames([], 100)).toEqual([]);
});
