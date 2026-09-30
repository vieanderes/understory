test('each call adds a film and returns the new count', () => {
  const watchlist = new Watchlist();
  const add = addHandler(watchlist);
  expect(add('Paddington')).toBe(1);
  expect(add('Amélie')).toBe(2);
  expect(watchlist.films).toEqual(['Paddington', 'Amélie']);
});

test('keeps its watchlist when another object calls it', () => {
  const watchlist = new Watchlist();
  const button = { films: [], onClick: addHandler(watchlist) };
  button.onClick('Up');
  expect(watchlist.films).toEqual(['Up']);
  expect(button.films).toEqual([]);
});

test('works when map calls it', () => {
  const watchlist = new Watchlist();
  expect(['Up', 'Heat'].map(addHandler(watchlist))).toEqual([1, 2]);
});

test('two handlers keep two watchlists apart', () => {
  const mine = new Watchlist();
  const yours = new Watchlist();
  addHandler(mine)('Up');
  expect(addHandler(yours)('Heat')).toBe(1);
  expect(mine.films).toEqual(['Up']);
});
