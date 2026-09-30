import { measure } from './solution';

// A fake clock: each call to fn moves the time on by the next duration in the list.
function fakeWork(durations: number[]) {
  let clock = 0;
  let calls = 0;
  const fn = () => {
    clock += durations[calls] ?? 0;
    calls += 1;
  };
  return { fn, now: () => clock, calls: () => calls };
}

test('the warm-up call is not counted', () => {
  const work = fakeWork([50, 10, 12, 11]);
  expect(measure(work.fn, 3, work.now)).toBe(11);
});

test('fn runs once more than the timed runs', () => {
  const work = fakeWork([5, 5, 5, 5, 5, 5]);
  measure(work.fn, 5, work.now);
  expect(work.calls()).toBe(6);
});

test('one stray slow run does not move the median', () => {
  const work = fakeWork([20, 10, 90, 11, 12, 10]);
  expect(measure(work.fn, 5, work.now)).toBe(11);
});

test('an even number of runs averages the two middle times', () => {
  const work = fakeWork([5, 10, 20, 12, 30]);
  expect(measure(work.fn, 4, work.now)).toBe(16);
});
