test('an https link may open', () => {
  expect(safeToOpen('https://example.com/help')).toBe(true);
});

test('the scheme can be in capitals', () => {
  expect(safeToOpen('HTTPS://example.com')).toBe(true);
});

test('a file on the computer may not', () => {
  expect(safeToOpen('file:///Applications/Calculator.app')).toBe(false);
});

test('a javascript: link may not', () => {
  expect(safeToOpen('javascript:alert(1)')).toBe(false);
});

test('a link that only mentions https may not', () => {
  expect(safeToOpen('myapp://open?next=https://example.com')).toBe(false);
});

test('text that is not a URL may not', () => {
  expect(safeToOpen('not a link')).toBe(false);
});
