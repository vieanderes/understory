import { slidingWindow } from './solution';

const run = (allow: (now: number) => boolean, times: number[]) => times.map((time) => allow(time));

test('allows up to the limit in one window', () => {
  expect(run(slidingWindow(3, 1000), [0, 10, 20, 30])).toEqual([true, true, true, false]);
});

test('a full window right before the edge still counts after it', () => {
  expect(run(slidingWindow(3, 1000), [997, 998, 999, 1000])).toEqual([true, true, true, false]);
});

test('the previous window fades as the new one goes on', () => {
  const times = [0, 10, 20, 1500, 1500, 1500];
  expect(run(slidingWindow(3, 1000), times)).toEqual([true, true, true, true, true, false]);
});

test('after an idle window, the old count is forgotten', () => {
  expect(run(slidingWindow(2, 1000), [0, 10, 2000, 2010])).toEqual([true, true, true, true]);
});

test('rejected requests do not use up the limit', () => {
  const times = [0, 10, 20, 30, 40, 1500];
  expect(run(slidingWindow(2, 1000), times)).toEqual([true, true, false, false, false, true]);
});
