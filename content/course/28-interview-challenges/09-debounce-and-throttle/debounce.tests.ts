import { debounce } from './debounce.solution';

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

test('one call runs once the wait is over, not before', () => {
  const timers = fakeTimers();
  const calls: string[] = [];
  const search = debounce((query: string) => calls.push(query), 300, timers);
  search('cat');
  timers.advance(299);
  expect(calls).toEqual([]);
  timers.advance(1);
  expect(calls).toEqual(['cat']);
});

test('a burst of calls runs once, with the last arguments', () => {
  const timers = fakeTimers();
  const calls: string[] = [];
  const search = debounce((query: string) => calls.push(query), 300, timers);
  search('c');
  search('ca');
  search('cat');
  timers.advance(1000);
  expect(calls).toEqual(['cat']);
  expect(timers.pending()).toBe(0);
});

test('each call restarts the wait', () => {
  const timers = fakeTimers();
  const calls: string[] = [];
  const search = debounce((query: string) => calls.push(query), 300, timers);
  search('ca');
  timers.advance(200);
  search('cat');
  timers.advance(200);
  expect(calls).toEqual([]);
  timers.advance(100);
  expect(calls).toEqual(['cat']);
});

test('two bursts with a pause between run twice', () => {
  const timers = fakeTimers();
  const calls: string[] = [];
  const search = debounce((query: string) => calls.push(query), 300, timers);
  search('cat');
  timers.advance(400);
  search('dog');
  timers.advance(400);
  expect(calls).toEqual(['cat', 'dog']);
});

test('cancel drops the pending call, and later calls still work', () => {
  const timers = fakeTimers();
  const calls: string[] = [];
  const search = debounce((query: string) => calls.push(query), 300, timers);
  search('cat');
  search.cancel();
  timers.advance(1000);
  expect(calls).toEqual([]);
  search('dog');
  timers.advance(300);
  expect(calls).toEqual(['dog']);
});

test('flush runs the pending call now, and nothing runs later', () => {
  const timers = fakeTimers();
  const calls: string[] = [];
  const save = debounce((draft: string) => calls.push(draft), 1000, timers);
  save('Hello');
  save('Hello, world');
  save.flush();
  expect(calls).toEqual(['Hello, world']);
  timers.advance(5000);
  expect(calls).toEqual(['Hello, world']);
});

test('flush with nothing pending does nothing', () => {
  const timers = fakeTimers();
  const calls: string[] = [];
  const save = debounce((draft: string) => calls.push(draft), 1000, timers);
  save.flush();
  save('Hi');
  timers.advance(1000);
  save.flush();
  expect(calls).toEqual(['Hi']);
});
