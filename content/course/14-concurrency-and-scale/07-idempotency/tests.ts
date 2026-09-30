import { withIdempotency, type Entry, type Reply } from './solution';

// A fake payment endpoint. It counts charges and takes a few microtask turns.
function makeCharges() {
  const stats = { charges: 0 };
  async function charge(body: string): Promise<Reply> {
    stats.charges += 1;
    for (let tick = 0; tick < 3; tick++) await Promise.resolve();
    return { status: 201, body: `charge ${stats.charges} for ${body}` };
  }
  return { charge, stats };
}

test('a repeat with the same key gets the stored reply and charges once', async () => {
  const { charge, stats } = makeCharges();
  const handle = withIdempotency(new Map<string, Entry>(), charge);
  const first = await handle('key-1', '1250');
  const again = await handle('key-1', '1250');
  expect(again).toEqual(first);
  expect(stats.charges).toBe(1);
});

test('different keys are different charges', async () => {
  const { charge, stats } = makeCharges();
  const handle = withIdempotency(new Map<string, Entry>(), charge);
  await handle('key-1', '1250');
  await handle('key-2', '1250');
  expect(stats.charges).toBe(2);
});

test('a repeat that arrives while the first runs gets 409 and charges nothing', async () => {
  const { charge, stats } = makeCharges();
  const handle = withIdempotency(new Map<string, Entry>(), charge);
  const [first, second] = await Promise.all([handle('key-1', '1250'), handle('key-1', '1250')]);
  expect(first.status).toBe(201);
  expect(second.status).toBe(409);
  expect(stats.charges).toBe(1);
});

test('an error reply is stored and replayed too', async () => {
  let calls = 0;
  const declined = async (): Promise<Reply> => {
    calls += 1;
    return { status: 402, body: 'Card declined' };
  };
  const handle = withIdempotency(new Map<string, Entry>(), declined);
  await handle('key-1', '1250');
  expect(await handle('key-1', '1250')).toEqual({ status: 402, body: 'Card declined' });
  expect(calls).toBe(1);
});

test('when the handler throws, the key is released so a retry can run', async () => {
  let calls = 0;
  const flaky = async (): Promise<Reply> => {
    calls += 1;
    if (calls === 1) throw new Error('database went away');
    return { status: 201, body: 'charged' };
  };
  const handle = withIdempotency(new Map<string, Entry>(), flaky);
  let failed = false;
  try {
    await handle('key-1', '1250');
  } catch {
    failed = true;
  }
  expect(failed).toBe(true);
  expect(await handle('key-1', '1250')).toEqual({ status: 201, body: 'charged' });
});
