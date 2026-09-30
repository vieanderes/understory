const rows = [
  { name: 'Pen', qty: 2 },
  { name: 'Pad', qty: 5 },
];

test('rowsToCsv writes a header and one line per row', () => {
  expect(rowsToCsv(rows)).toBe('name,qty\nPen,2\nPad,5');
});

test('rowsToCsv keeps the header when there are no rows', () => {
  expect(rowsToCsv([])).toBe('name,qty');
});

test('rowsToList writes one line per row', () => {
  expect(rowsToList(rows)).toBe('Pen: 2\nPad: 5');
});

test('rowsToList returns empty text when there are no rows', () => {
  expect(rowsToList([])).toBe('');
});
