import { health } from './solution';

const never = () => new Promise<void>(() => {});
const answers = async () => {};
const refuses = async () => {
  throw new Error('connect ECONNREFUSED 172.18.0.2:5432');
};

test('a database that answers gives 200 ok', async () => {
  expect(await health(answers, never, 500)).toEqual({ status: 200, body: 'ok' });
});

test('a database that refuses gives 503 database unreachable', async () => {
  expect(await health(refuses, never, 500)).toEqual({ status: 503, body: 'database unreachable' });
});

test('a database that hangs gives 503 database timeout', async () => {
  expect(await health(never, async () => {}, 500)).toEqual({ status: 503, body: 'database timeout' });
});

test('the deadline is timeoutMs', async () => {
  const asked: number[] = [];
  const sleep = (ms: number) => {
    asked.push(ms);
    return never();
  };
  await health(answers, sleep, 800);
  expect(asked).toEqual([800]);
});
