// A pool of two clients that counts how many are out.
function makePool() {
  const pool = {
    out: 0,
    async connect() {
      if (pool.out === 2) throw new Error('pool exhausted');
      pool.out = pool.out + 1;
      return { release: () => { pool.out = pool.out - 1; } };
    },
  };
  return pool;
}

test('returns what the work returns', async () => {
  const pool = makePool();
  expect(await withClient(pool, async () => 42)).toBe(42);
});

test('gives the client back after the work', async () => {
  const pool = makePool();
  await withClient(pool, async () => 'done');
  expect(pool.out).toBe(0);
});

test('gives the client back when the work throws', async () => {
  const pool = makePool();
  let caught = '';
  try {
    await withClient(pool, async () => {
      throw new Error('query failed');
    });
  } catch (error) {
    caught = error.message;
  }
  expect(caught).toBe('query failed');
  expect(pool.out).toBe(0);
});

test('five calls in a row never run out of clients', async () => {
  const pool = makePool();
  for (let i = 0; i < 5; i++) await withClient(pool, async () => i);
  expect(pool.out).toBe(0);
});
