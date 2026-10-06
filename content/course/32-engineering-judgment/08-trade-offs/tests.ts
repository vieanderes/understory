import { breakEvenYear } from './solution';

test('buying overtakes building as members grow', () => {
  const build = { upfront: 20000, perYear: 6000 };
  const buy = { perUserPerMonth: 0.5, users: [1000, 2000, 4000, 8000] };
  expect(breakEvenYear(build, buy)).toBe(3);
});

test('a service that stays cheap never breaks even', () => {
  const build = { upfront: 20000, perYear: 6000 };
  const buy = { perUserPerMonth: 0.5, users: [100, 100, 100] };
  expect(breakEvenYear(build, buy)).toBeNull();
});

test('buying can cost more from year 1', () => {
  const build = { upfront: 2000, perYear: 1000 };
  const buy = { perUserPerMonth: 2, users: [200] };
  expect(breakEvenYear(build, buy)).toBe(1);
});

test('a tie is not more, so the next year counts', () => {
  const build = { upfront: 600, perYear: 600 };
  const buy = { perUserPerMonth: 1, users: [100, 200] };
  expect(breakEvenYear(build, buy)).toBe(2);
});

test('upkeep counts every year, not only the first', () => {
  const build = { upfront: 0, perYear: 5000 };
  const buy = { perUserPerMonth: 1, users: [400, 400, 400] };
  expect(breakEvenYear(build, buy)).toBeNull();
});

test('no years given means no answer', () => {
  expect(breakEvenYear({ upfront: 100, perYear: 10 }, { perUserPerMonth: 5, users: [] })).toBeNull();
});
