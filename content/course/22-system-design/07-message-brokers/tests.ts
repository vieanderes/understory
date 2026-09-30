import { applyOnce } from './solution';

test('applies each new message once', () => {
  const seen = new Set<string>();
  const out = applyOnce(
    [
      { id: 'm1', account: 'a', amount: 10 },
      { id: 'm2', account: 'b', amount: 5 },
      { id: 'm3', account: 'a', amount: 2 },
    ],
    seen,
  );
  expect(out).toEqual({ a: 12, b: 5 });
});

test('a duplicate inside one batch counts once', () => {
  const out = applyOnce(
    [
      { id: 'm1', account: 'a', amount: 10 },
      { id: 'm1', account: 'a', amount: 10 },
    ],
    new Set<string>(),
  );
  expect(out).toEqual({ a: 10 });
});

test('skips ids processed in an earlier batch', () => {
  const seen = new Set<string>(['m1']);
  const out = applyOnce(
    [
      { id: 'm1', account: 'a', amount: 10 },
      { id: 'm2', account: 'a', amount: 3 },
    ],
    seen,
  );
  expect(out).toEqual({ a: 3 });
});

test('records every id it applied', () => {
  const seen = new Set<string>();
  applyOnce([{ id: 'm7', account: 'c', amount: 1 }], seen);
  expect(seen.has('m7')).toBe(true);
});

test('a redelivered batch changes nothing', () => {
  const seen = new Set<string>();
  const batch = [{ id: 'm1', account: 'a', amount: 10 }];
  applyOnce(batch, seen);
  expect(applyOnce(batch, seen)).toEqual({});
});

test('an empty batch gives no totals', () => {
  expect(applyOnce([], new Set<string>())).toEqual({});
});
