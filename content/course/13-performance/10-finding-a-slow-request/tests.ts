import { attachAuthors } from './solution';

const directory = new Map([
  [7, 'Ines'],
  [8, 'Kwame'],
]);

function fakeLoader() {
  const calls: number[][] = [];
  const loadAuthors = async (ids: number[]) => {
    calls.push(ids);
    const names = new Map<number, string>();
    for (const id of ids) {
      const name = directory.get(id);
      if (name !== undefined) names.set(id, name);
    }
    return names;
  };
  return { calls, loadAuthors };
}

const books = [
  { id: 1, title: 'Night trains', authorId: 7 },
  { id: 2, title: 'Salt and stone', authorId: 8 },
  { id: 3, title: 'Late light', authorId: 7 },
];

test('every book gets its author', async () => {
  const { loadAuthors } = fakeLoader();
  const result = await attachAuthors(books, loadAuthors);
  expect(result.map((book) => book.author)).toEqual(['Ines', 'Kwame', 'Ines']);
});

test('the authors are loaded with one call', async () => {
  const { calls, loadAuthors } = fakeLoader();
  await attachAuthors(books, loadAuthors);
  expect(calls).toHaveLength(1);
});

test('each author id is asked for once', async () => {
  const { calls, loadAuthors } = fakeLoader();
  await attachAuthors(books, loadAuthors);
  expect([...(calls[0] ?? [])].sort()).toEqual([7, 8]);
});

test('the books keep their order and fields', async () => {
  const { loadAuthors } = fakeLoader();
  const result = await attachAuthors(books, loadAuthors);
  expect(result[2]).toEqual({ id: 3, title: 'Late light', authorId: 7, author: 'Ines' });
});

test('an author missing from the result shows as Unknown', async () => {
  const { loadAuthors } = fakeLoader();
  const result = await attachAuthors([{ id: 4, title: 'Tidelines', authorId: 99 }], loadAuthors);
  expect(result[0]?.author).toBe('Unknown');
});
