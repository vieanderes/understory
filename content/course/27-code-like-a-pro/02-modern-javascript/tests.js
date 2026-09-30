test('keeps subscribed users only, in lower case', () => {
  const users = [
    { email: 'Ana@Example.com', subscribed: true },
    { email: 'ben@example.com', subscribed: false },
  ];
  expect(subscriberEmails(users)).toEqual(['ana@example.com']);
});

test('skips a missing or empty email', () => {
  const users = [
    { email: '', subscribed: true },
    { subscribed: true },
    { email: 'cy@example.com', subscribed: true },
  ];
  expect(subscriberEmails(users)).toEqual(['cy@example.com']);
});

test('returns each address once, keeping the first position', () => {
  const users = [
    { email: 'dee@example.com', subscribed: true },
    { email: 'eve@example.com', subscribed: true },
    { email: 'DEE@example.com', subscribed: true },
  ];
  expect(subscriberEmails(users)).toEqual(['dee@example.com', 'eve@example.com']);
});

test('returns an empty list for no users', () => {
  expect(subscriberEmails([])).toEqual([]);
});
