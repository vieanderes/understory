import { throttle } from './throttle.solution';

// A fake clock: timers run only when a test moves time with advance.
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const due = new Map<number, { at: number; fn: () => void }>();
  return {
    set(fn: () => void, ms: number): number {
      due.set(nextId, { at: now + ms, fn });
      return nextId++;
    },
    clear(id: number | undefined): void {
      if (id !== undefined) due.delete(id);
    },
    advance(ms: number): void {
      const end = now + ms;
      for (;;) {
        let next: [number, { at: number; fn: () => void }] | undefined;
        for (const entry of due) if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
        if (!next) break;
        due.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
    pending(): number {
      return due.size;
    },
  };
}

test('the first call runs at once', () => {
  const timers = fakeTimers();
  const saved: number[] = [];
  const save = throttle((y: number) => saved.push(y), 100, timers);
  save(0);
  expect(saved).toEqual([0]);
});

test('calls inside the interval wait, and the latest runs when it ends', () => {
  const timers = fakeTimers();
  const saved: number[] = [];
  const save = throttle((y: number) => saved.push(y), 100, timers);
  save(0);
  timers.advance(30);
  save(30);
  timers.advance(30);
  save(60);
  expect(saved).toEqual([0]);
  timers.advance(40);
  expect(saved).toEqual([0, 60]);
});

test('a lone call has no trailing repeat, and the next call runs at once', () => {
  const timers = fakeTimers();
  const saved: number[] = [];
  const save = throttle((y: number) => saved.push(y), 100, timers);
  save(0);
  timers.advance(500);
  expect(saved).toEqual([0]);
  save(500);
  expect(saved).toEqual([0, 500]);
});

test('a steady stream runs about once per interval and ends with the last value', () => {
  const timers = fakeTimers();
  const saved: number[] = [];
  const save = throttle((y: number) => saved.push(y), 100, timers);
  for (let t = 0; t < 250; t += 10) {
    save(t);
    timers.advance(10);
  }
  timers.advance(1000);
  expect(saved).toEqual([0, 90, 190, 240]);
  expect(timers.pending()).toBe(0);
});

test('a trailing call keeps the next call at least an interval away', () => {
  const timers = fakeTimers();
  const saved: number[] = [];
  const save = throttle((y: number) => saved.push(y), 100, timers);
  save(0);
  timers.advance(50);
  save(50);
  timers.advance(50);
  expect(saved).toEqual([0, 50]);
  save(100);
  expect(saved).toEqual([0, 50]);
  timers.advance(100);
  expect(saved).toEqual([0, 50, 100]);
});

test('each throttled function keeps its own state', () => {
  const timers = fakeTimers();
  const log: string[] = [];
  const saveA = throttle((v: string) => log.push(v), 100, timers);
  const saveB = throttle((v: string) => log.push(v), 100, timers);
  saveA('a');
  saveB('b');
  expect(log).toEqual(['a', 'b']);
});
