test('shows the receipt line exactly', () => {
  expect(printed()).toEqual(['4 coffees cost 12 pounds']);
});

test('the variables still hold 3 and 4', () => {
  expect(price).toBe(3);
  expect(cups).toBe(4);
});
