import { pickNext, type Job, type Scheduler } from './solution';

const low = (id: string, enqueuedAt = 0): Job => ({ id, priority: 'low', enqueuedAt });
const high = (id: string, enqueuedAt = 0): Job => ({ id, priority: 'high', enqueuedAt });

function scheduler(queues: Record<string, Job[]>, extra: Partial<Scheduler> = {}): Scheduler {
  return {
    tenants: Object.keys(queues),
    queues,
    running: {},
    cursor: 0,
    maxRunningPerTenant: 100,
    maxWaitMs: 60_000,
    ...extra,
  };
}

function pickIds(s: Scheduler, count: number, now = 0): (string | undefined)[] {
  return Array.from({ length: count }, () => pickNext(s, now)?.id);
}

test('takes one job from each tenant in turn, so a big backlog cannot starve the rest', () => {
  const s = scheduler({ big: [low('b1'), low('b2'), low('b3')], tiny: [low('t1')], small: [low('s1')] });
  expect(pickIds(s, 5)).toEqual(['b1', 't1', 's1', 'b2', 'b3']);
});

test('a high job goes before low jobs, even from a tenant later in the turn', () => {
  const s = scheduler({ big: [low('b1')], tiny: [high('t1')] });
  expect(pickIds(s, 2)).toEqual(['t1', 'b1']);
});

test('takes a high job from the middle of a queue and leaves the low one in place', () => {
  const s = scheduler({ shop: [low('s1'), high('s2')] });
  expect(pickNext(s, 0)?.id).toBe('s2');
  expect(s.queues.shop?.map((job) => job.id)).toEqual(['s1']);
});

test('skips a tenant at its running cap and counts what it starts', () => {
  const s = scheduler({ big: [high('b1')], tiny: [low('t1')] }, { running: { big: 2 }, maxRunningPerTenant: 2 });
  expect(pickNext(s, 0)?.id).toBe('t1');
  expect(s.running.tiny).toBe(1);
  expect(pickNext(s, 0)).toBe(undefined);
  expect(s.queues.big).toHaveLength(1);
});

test('a low job that waited past maxWaitMs is no longer starved by a stream of high jobs', () => {
  const s = scheduler({ signups: [high('h1'), high('h2'), high('h3')], issues: [low('l1', 0)] });
  expect(pickIds(s, 3, 60_000)).toEqual(['h1', 'l1', 'h2']);
});

test('a fresh low job still waits for high work', () => {
  const s = scheduler({ issues: [low('l1', 50_000)], signups: [high('h1'), high('h2')] });
  expect(pickIds(s, 3, 60_000)).toEqual(['h1', 'h2', 'l1']);
});

test('returns undefined when every queue is empty, and leaves the cursor alone', () => {
  const s = scheduler({ big: [], tiny: [] }, { cursor: 1 });
  expect(pickNext(s, 0)).toBe(undefined);
  expect(s.cursor).toBe(1);
});
