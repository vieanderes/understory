test('handles every item, in order', async () => {
  const seen = [];
  await handleInChunks([1, 2, 3, 4, 5], 2, (item) => seen.push(item));
  expect(seen).toEqual([1, 2, 3, 4, 5]);
});

test('lets a waiting timer run between two chunks', async () => {
  const log = [];
  setTimeout(() => log.push('timer'), 0);
  await handleInChunks([1, 2, 3, 4], 2, (item) => log.push(item));
  expect(log).toEqual([1, 2, 'timer', 3, 4]);
});

test('handles a whole chunk before it waits', async () => {
  const log = [];
  setTimeout(() => log.push('timer'), 0);
  await handleInChunks(['a', 'b', 'c'], 3, (item) => log.push(item));
  expect(log.slice(0, 3)).toEqual(['a', 'b', 'c']);
});

test('works when the last chunk is short', async () => {
  const seen = [];
  await handleInChunks([1, 2, 3], 2, (item) => seen.push(item));
  expect(seen).toEqual([1, 2, 3]);
});

test('an empty list handles nothing', async () => {
  const seen = [];
  await handleInChunks([], 2, (item) => seen.push(item));
  expect(seen).toEqual([]);
});
