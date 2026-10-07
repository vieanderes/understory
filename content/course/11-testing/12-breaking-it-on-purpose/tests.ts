import { injectFaults, type Fault, type Reply } from './solution';

// A fake nutrition vendor that counts the calls that really reach it.
function makeVendor() {
  const seen: string[] = [];
  const call = async (path: string): Promise<Reply> => {
    seen.push(path);
    return { status: 200, body: `nutrition for ${path}` };
  };
  return { call, seen };
}

// A fake clock: it records each sleep and returns at once.
function makeSleep() {
  const slept: number[] = [];
  const sleep = async (ms: number) => {
    slept.push(ms);
  };
  return { sleep, slept };
}

async function failureOf(run: () => Promise<unknown>): Promise<Error & { code?: string }> {
  try {
    await run();
  } catch (error) {
    return error as Error & { code?: string };
  }
  throw new Error('expected the call to fail');
}

test('ok passes the call through untouched', async () => {
  const vendor = makeVendor();
  const wrapped = injectFaults(vendor.call, ['ok'], makeSleep().sleep);
  expect(await wrapped('/recipes/42')).toEqual({ status: 200, body: 'nutrition for /recipes/42' });
  expect(vendor.seen).toEqual(['/recipes/42']);
});

test('error500 answers 500 without calling the vendor', async () => {
  const vendor = makeVendor();
  const wrapped = injectFaults(vendor.call, ['error500'], makeSleep().sleep);
  expect(await wrapped('/recipes/7')).toEqual({ status: 500, body: 'Injected fault' });
  expect(vendor.seen).toEqual([]);
});

test('timeout throws an error named TimeoutError', async () => {
  const vendor = makeVendor();
  const wrapped = injectFaults(vendor.call, ['timeout'], makeSleep().sleep);
  const error = await failureOf(() => wrapped('/recipes/7'));
  expect(error.name).toBe('TimeoutError');
  expect(vendor.seen).toEqual([]);
});

test('drop throws an error with code ECONNRESET', async () => {
  const vendor = makeVendor();
  const wrapped = injectFaults(vendor.call, ['drop'], makeSleep().sleep);
  const error = await failureOf(() => wrapped('/recipes/7'));
  expect(error.code).toBe('ECONNRESET');
  expect(vendor.seen).toEqual([]);
});

test('slow sleeps for slowMs, then really calls the vendor', async () => {
  const vendor = makeVendor();
  const clock = makeSleep();
  const wrapped = injectFaults(vendor.call, ['slow'], clock.sleep, 2500);
  expect((await wrapped('/recipes/3')).status).toBe(200);
  expect(clock.slept).toEqual([2500]);
  expect(vendor.seen).toEqual(['/recipes/3']);
});

test('the schedule advances on every call and starts again at the end', async () => {
  const vendor = makeVendor();
  const schedule: Fault[] = ['ok', 'error500', 'ok'];
  const wrapped = injectFaults(vendor.call, schedule, makeSleep().sleep);
  const statuses: number[] = [];
  for (let i = 1; i <= 6; i++) statuses.push((await wrapped(`/recipes/${i}`)).status);
  expect(statuses).toEqual([200, 500, 200, 200, 500, 200]);
  expect(vendor.seen).toEqual(['/recipes/1', '/recipes/3', '/recipes/4', '/recipes/6']);
});
