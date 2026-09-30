import { stressTest } from './solution';

// A small seeded generator, so a failing input can be made again from its seed.
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function counter(): () => number {
  let n = 0;
  return () => ++n;
}

test('returns null when the two always agree', () => {
  const double = (n: number) => n * 2;
  expect(stressTest(double, double, counter(), 50)).toBe(null);
});

test('returns the first input where they disagree', () => {
  const fast = (n: number) => (n < 5 ? n * 2 : n * 2 + 1);
  const slow = (n: number) => n * 2;
  expect(stressTest(fast, slow, counter(), 50)).toBe(5);
});

test('stops generating after the first failure', () => {
  let made = 0;
  const generate = () => ++made;
  const fast = (n: number) => (n === 3 ? -1 : n);
  stressTest(fast, (n: number) => n, generate, 100);
  expect(made).toBe(3);
});

test('makes exactly `runs` inputs when nothing fails', () => {
  let made = 0;
  const generate = () => ++made;
  stressTest((n: number) => n, (n: number) => n, generate, 40);
  expect(made).toBe(40);
  expect(stressTest((n: number) => n, (n: number) => -n, generate, 0)).toBe(null);
});

test('compares arrays by value', () => {
  const byCompare = (xs: number[]) => [...xs].sort((a, b) => a - b);
  const byInsertion = (xs: number[]) => {
    const out: number[] = [];
    for (const x of xs) {
      let i = out.length;
      while (i > 0 && (out[i - 1] ?? -Infinity) > x) i--;
      out.splice(i, 0, x);
    }
    return out;
  };
  const random = makeRandom(7);
  const generate = () => [Math.floor(random() * 10), Math.floor(random() * 10), 3];
  expect(stressTest(byCompare, byInsertion, generate, 200)).toBe(null);
});

test('finds the bug in a fast best-run sum', () => {
  const fast = (nums: number[]) => {
    let best = 0;
    let run = 0;
    for (const x of nums) {
      run = Math.max(x, run + x);
      best = Math.max(best, run);
    }
    return best;
  };
  const slow = (nums: number[]) => {
    let best = -Infinity;
    for (let i = 0; i < nums.length; i++) {
      let sum = 0;
      for (const x of nums.slice(i)) {
        sum += x;
        best = Math.max(best, sum);
      }
    }
    return best;
  };
  const random = makeRandom(42);
  const generate = () => {
    const length = 1 + Math.floor(random() * 4);
    const nums: number[] = [];
    for (let i = 0; i < length; i++) nums.push(Math.floor(random() * 11) - 5);
    return nums;
  };
  const found = stressTest(fast, slow, generate, 500);
  expect(found).not.toBe(null);
  if (found) expect(fast(found)).not.toBe(slow(found));
});
