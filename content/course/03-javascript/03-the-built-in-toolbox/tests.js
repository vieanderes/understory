test('one item gives its line and a total', () => {
  expect(receiptLines([{ name: 'Tea', pence: 225, quantity: 2 }])).toEqual([
    'Tea x2    4.50',
    'Total    4.50',
  ]);
});

test('amounts are padded to seven characters, so they line up', () => {
  const lines = receiptLines([{ name: 'Oats', pence: 12000, quantity: 1 }]);
  expect(lines[0]).toBe('Oats x1  120.00');
});

test('the total adds every line', () => {
  const items = [
    { name: 'Tea', pence: 225, quantity: 2 },
    { name: 'Milk', pence: 95, quantity: 1 },
  ];
  expect(receiptLines(items)[2]).toBe('Total    5.45');
});

test('an empty receipt still has a total of 0.00', () => {
  expect(receiptLines([])).toEqual(['Total    0.00']);
});

test('the input array is not changed', () => {
  const items = Object.freeze([{ name: 'Tea', pence: 225, quantity: 1 }]);
  receiptLines(items);
  expect(items).toHaveLength(1);
});
