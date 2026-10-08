import { callTool, type Deps } from './breaker.solution';

// A fake clock and a fake service: `down` lists the tools that throw right now.
function setup(down: string[]) {
  let time = 0;
  const calls: string[] = [];
  const deps: Deps = {
    run: async (name) => {
      calls.push(name);
      if (down.includes(name)) throw new Error('503 Service Unavailable');
      return { tool: name, answer: 'ok' };
    },
    now: () => time,
    breakers: new Map(),
    threshold: 3,
    cooldownMs: 60_000,
  };
  return { deps, calls, down, tick: (ms: number) => (time += ms) };
}

test('a working tool returns its data', async () => {
  const { deps } = setup([]);
  expect(await callTool('get_forecast', { city: 'Lyon' }, deps)).toEqual({
    ok: true,
    data: { tool: 'get_forecast', answer: 'ok' },
  });
});

test('a failure below the threshold is a retryable error', async () => {
  const { deps } = setup(['get_forecast']);
  const result = await callTool('get_forecast', {}, deps);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toBe('failed');
    expect(result.retryable).toBe(true);
    expect(result.message).toContain('get_forecast');
  }
});

test('the third failure opens the breaker, and the next call never reaches the service', async () => {
  const { deps, calls } = setup(['get_forecast']);
  await callTool('get_forecast', {}, deps);
  await callTool('get_forecast', {}, deps);
  const third = await callTool('get_forecast', {}, deps);
  const fourth = await callTool('get_forecast', {}, deps);
  expect(calls).toHaveLength(3);
  expect(third).toEqual(fourth);
  if (!fourth.ok) {
    expect(fourth.error).toBe('unavailable');
    expect(fourth.retryable).toBe(false);
    expect(fourth.message).toContain('get_forecast');
  }
});

test('each tool has its own breaker', async () => {
  const { deps, calls } = setup(['get_forecast']);
  for (let i = 0; i < 4; i++) await callTool('get_forecast', {}, deps);
  const train = await callTool('find_trains', {}, deps);
  expect(train.ok).toBe(true);
  expect(calls.filter((name) => name === 'find_trains')).toHaveLength(1);
});

test('after the cool-down one trial goes through, and a success closes the breaker', async () => {
  const { deps, calls, down, tick } = setup(['get_forecast']);
  for (let i = 0; i < 3; i++) await callTool('get_forecast', {}, deps);
  tick(59_999);
  expect((await callTool('get_forecast', {}, deps)).ok).toBe(false);
  expect(calls).toHaveLength(3);
  tick(1);
  down.length = 0;
  expect((await callTool('get_forecast', {}, deps)).ok).toBe(true);
  expect((await callTool('get_forecast', {}, deps)).ok).toBe(true);
  expect(calls).toHaveLength(5);
});

test('a failed trial reopens the breaker at once', async () => {
  const { deps, calls, tick } = setup(['get_forecast']);
  for (let i = 0; i < 3; i++) await callTool('get_forecast', {}, deps);
  tick(60_000);
  const trial = await callTool('get_forecast', {}, deps);
  const after = await callTool('get_forecast', {}, deps);
  expect(calls).toHaveLength(4);
  if (!trial.ok && !after.ok) {
    expect(trial.error).toBe('unavailable');
    expect(after.error).toBe('unavailable');
  }
});

test('a success resets the count of failures in a row', async () => {
  const { deps, calls, down } = setup(['get_forecast']);
  await callTool('get_forecast', {}, deps);
  await callTool('get_forecast', {}, deps);
  down.length = 0;
  await callTool('get_forecast', {}, deps);
  down.push('get_forecast');
  await callTool('get_forecast', {}, deps);
  await callTool('get_forecast', {}, deps);
  const result = await callTool('get_forecast', {}, deps);
  expect(calls).toHaveLength(6);
  if (!result.ok) expect(result.error).toBe('unavailable');
});
