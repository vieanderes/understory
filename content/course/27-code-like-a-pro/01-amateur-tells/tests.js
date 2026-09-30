const tea = { name: 'Tea', price: 2.5, qty: 3 };
const cake = { name: 'Cake', price: 3.2, qty: 1 };

test('lineTotal multiplies price by quantity', () => {
  expect(lineTotal(tea)).toBe(7.5);
});

test('orderLine shows the name and the line total', () => {
  expect(orderLine(tea)).toBe('Tea: £7.50');
});

test('totalLine adds every line', () => {
  expect(totalLine([tea, cake])).toBe('Total: £10.70');
});

test('totalLine shows zero for an empty order', () => {
  expect(totalLine([])).toBe('Total: £0.00');
});

test('prints nothing while it works', () => {
  orderLine(tea);
  totalLine([tea, cake]);
  expect(printed()).toEqual([]);
});
