import { paginate, type Book, type FetchPage } from './solution';

function book(id: string, second: number): Book {
  return { id, title: `Title ${id}`, updatedAt: `2026-10-01T10:00:${String(second).padStart(2, '0')}Z` };
}

// A fake vendor with an inclusive updated_since filter. It refuses to be paged for ever.
function vendor(books: Book[]) {
  const calls: string[] = [];
  const sorted = [...books].sort((a, b) =>
    a.updatedAt === b.updatedAt ? (a.id < b.id ? -1 : 1) : a.updatedAt < b.updatedAt ? -1 : 1,
  );
  const fetchPage: FetchPage = async (since, limit) => {
    calls.push(since);
    if (calls.length > 20) throw new Error('paged more than 20 times');
    const matching = sorted.filter((b) => b.updatedAt >= since);
    return { books: matching.slice(0, limit), hasMore: matching.length > limit };
  };
  return { fetchPage, calls };
}

async function ids(books: AsyncIterable<Book>): Promise<string[]> {
  const out: string[] = [];
  for await (const b of books) out.push(b.id);
  return out;
}

const START = '2026-10-01T00:00:00Z';

test('reads every book across pages, in order', async () => {
  const { fetchPage } = vendor([book('b1', 1), book('b2', 2), book('b3', 3), book('b4', 4), book('b5', 5)]);
  expect(await ids(paginate(fetchPage, START, 2))).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
});

test('books sharing a timestamp across a page boundary come once each', async () => {
  const { fetchPage } = vendor([book('b1', 3), book('b2', 4), book('b3', 5), book('b4', 5), book('b5', 6)]);
  expect(await ids(paginate(fetchPage, START, 3))).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
});

test('starts from since, and books before it are not read', async () => {
  const { fetchPage, calls } = vendor([book('b1', 1), book('b2', 30), book('b3', 40)]);
  expect(await ids(paginate(fetchPage, '2026-10-01T10:00:30Z', 2))).toEqual(['b2', 'b3']);
  expect(calls[0]).toBe('2026-10-01T10:00:30Z');
});

test('an empty vendor yields nothing after one call', async () => {
  const { fetchPage, calls } = vendor([]);
  expect(await ids(paginate(fetchPage, START, 2))).toEqual([]);
  expect(calls).toHaveLength(1);
});

test('a caller that stops early fetches no more pages', async () => {
  const { fetchPage, calls } = vendor([book('b1', 1), book('b2', 2), book('b3', 3), book('b4', 4)]);
  for await (const b of paginate(fetchPage, START, 2)) {
    if (b.id === 'b2') break;
  }
  expect(calls).toHaveLength(1);
});

test('a whole page on one timestamp throws instead of looping', async () => {
  const { fetchPage, calls } = vendor([book('b1', 5), book('b2', 5), book('b3', 5), book('b4', 9)]);
  let error = '';
  try {
    await ids(paginate(fetchPage, START, 2));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  expect(error).toMatch('share');
  expect(calls.length).toBeLessThanOrEqual(3);
});
