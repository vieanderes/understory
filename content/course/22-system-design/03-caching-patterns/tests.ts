import { coalesce } from './solution';

function counted(result: (key: string) => Promise<string>) {
  const calls: string[] = [];
  const load = (key: string) => {
    calls.push(key);
    return result(key);
  };
  return { calls, load };
}

const later = (value: string) => Promise.resolve().then(() => value);

test('concurrent reads of one key share a single load', async () => {
  const { calls, load } = counted((key) => later(`menu for ${key}`));
  const get = coalesce(load);
  const results = await Promise.all([get('cafe'), get('cafe'), get('cafe')]);
  expect(results).toEqual(['menu for cafe', 'menu for cafe', 'menu for cafe']);
  expect(calls).toEqual(['cafe']);
});

test('different keys load separately', async () => {
  const { calls, load } = counted((key) => later(key));
  const get = coalesce(load);
  await Promise.all([get('cafe'), get('diner')]);
  expect(calls).toEqual(['cafe', 'diner']);
});

test('a read after the load finished starts a new one', async () => {
  const { calls, load } = counted((key) => later(key));
  const get = coalesce(load);
  await get('cafe');
  await get('cafe');
  expect(calls).toEqual(['cafe', 'cafe']);
});

test('a failure reaches every waiting caller', async () => {
  const { calls, load } = counted(() => Promise.reject(new Error('database down')));
  const get = coalesce(load);
  const outcomes = await Promise.allSettled([get('cafe'), get('cafe')]);
  expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'rejected']);
  expect(calls).toEqual(['cafe']);
});

test('a failed load is forgotten, so the next read retries', async () => {
  let fail = true;
  const { calls, load } = counted((key) =>
    fail ? Promise.reject(new Error('down')) : later(key),
  );
  const get = coalesce(load);
  await get('cafe').catch(() => undefined);
  fail = false;
  expect(await get('cafe')).toBe('cafe');
  expect(calls).toEqual(['cafe', 'cafe']);
});
