test('keeps the emails that came back', () => {
  expect(repeatCustomers(['ana@mail.test', 'ben@mail.test'], ['ben@mail.test', 'caz@mail.test'])).toEqual([
    'ben@mail.test',
  ]);
});

test("keeps today's order", () => {
  expect(repeatCustomers(['a@mail.test', 'b@mail.test', 'c@mail.test'], ['c@mail.test', 'a@mail.test'])).toEqual([
    'c@mail.test',
    'a@mail.test',
  ]);
});

test('no one came back', () => {
  expect(repeatCustomers(['a@mail.test'], ['b@mail.test'])).toEqual([]);
  expect(repeatCustomers([], ['b@mail.test'])).toEqual([]);
});

test('copes with 20,000 emails a day', () => {
  const yesterday = [];
  const today = [];
  for (let i = 0; i < 20000; i++) {
    yesterday.push('old' + i + '@mail.test');
    today.push('new' + i + '@mail.test');
  }
  today.push('old7@mail.test', 'old19999@mail.test');
  expect(repeatCustomers(yesterday, today)).toEqual(['old7@mail.test', 'old19999@mail.test']);
});
