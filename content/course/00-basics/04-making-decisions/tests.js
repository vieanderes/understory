test('a 10-year-old pays the child price', () => {
  expect(price).toBe(5);
});

test('shows the ticket line using the price', () => {
  expect(printed()).toEqual(['Ticket: 5 pounds']);
});
