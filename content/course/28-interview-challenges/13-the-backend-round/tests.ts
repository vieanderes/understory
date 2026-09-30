import { createHandler } from './solution';
import type { Req, Res, Store } from './solution';

const newStore = (): Store => ({ bookings: [], responses: new Map<string, Res>() });
const post = (body: unknown, headers: Record<string, string> = {}): Req => ({
  method: 'POST', path: '/bookings', query: {}, headers, body,
});
const get = (query: Record<string, string> = {}): Req => ({
  method: 'GET', path: '/bookings', query, headers: {}, body: undefined,
});
const valid = { room: 'Oak', date: '2026-10-01', guests: 2 };

test('a valid booking is created with 201', async () => {
  const store = newStore();
  const res = await createHandler(store)(post(valid));
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ id: 1, room: 'Oak', date: '2026-10-01', guests: 2 });
  expect(store.bookings).toHaveLength(1);
});

test('invalid bodies get a 400 problem and store nothing', async () => {
  const store = newStore();
  const handle = createHandler(store);
  const bad = [null, 'Oak', { ...valid, guests: 0 }, { ...valid, guests: '2' }, { ...valid, room: '' }, { ...valid, date: 'tomorrow' }];
  for (const body of bad) {
    const res = await handle(post(body));
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toBe('application/problem+json');
    expect((res.body as { status: number }).status).toBe(400);
  }
  expect(store.bookings).toHaveLength(0);
});

test('a retried key returns the first response and books once', async () => {
  const store = newStore();
  const handle = createHandler(store);
  const first = await handle(post(valid, { 'idempotency-key': 'k-1' }));
  const retry = await handle(post(valid, { 'idempotency-key': 'k-1' }));
  expect(retry).toEqual(first);
  expect(store.bookings).toHaveLength(1);
  await handle(post(valid, { 'idempotency-key': 'k-2' }));
  expect(store.bookings).toHaveLength(2);
});

test('the list pages through with a cursor', async () => {
  const store = newStore();
  const handle = createHandler(store);
  for (let i = 0; i < 5; i++) await handle(post({ ...valid, guests: i + 1 }));
  const ids = (res: Res) => (res.body as { items: { id: number }[] }).items.map((b) => b.id);
  const cursor = (res: Res) => (res.body as { nextCursor: string | null }).nextCursor;
  const page1 = await handle(get({ limit: '2' }));
  expect(ids(page1)).toEqual([1, 2]);
  expect(cursor(page1)).toBe('2');
  const page2 = await handle(get({ limit: '2', after: '2' }));
  expect(ids(page2)).toEqual([3, 4]);
  const page3 = await handle(get({ limit: '2', after: '4' }));
  expect(ids(page3)).toEqual([5]);
  expect(cursor(page3)).toBe(null);
  expect(ids(await handle(get()))).toEqual([1, 2, 3, 4, 5]);
});

test('a bad limit or cursor gets a 400 problem', async () => {
  const handle = createHandler(newStore());
  const queries: Record<string, string>[] = [{ limit: '0' }, { limit: '101' }, { limit: 'ten' }, { after: 'abc' }];
  for (const query of queries) {
    const res = await handle(get(query));
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toBe('application/problem+json');
  }
});

test('unknown routes and methods get problems too', async () => {
  const handle = createHandler(newStore());
  const missing = await handle({ ...get(), path: '/rooms' });
  expect(missing.status).toBe(404);
  expect(missing.headers['content-type']).toBe('application/problem+json');
  const wrong = await handle({ ...get(), method: 'DELETE' });
  expect(wrong.status).toBe(405);
  expect((wrong.body as { title: string }).title).toBe('Method not allowed');
});
