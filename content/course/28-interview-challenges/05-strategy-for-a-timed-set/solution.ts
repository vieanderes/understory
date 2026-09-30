// Results are compared as JSON so that arrays and objects compare by value: two sorted
// copies of a list are different objects, and `!==` would call every run a failure.
export function stressTest<I, O>(
  fast: (input: I) => O,
  slow: (input: I) => O,
  generate: () => I,
  runs: number,
): I | null {
  for (let run = 0; run < runs; run++) {
    const input = generate();
    const expected = JSON.stringify(slow(input));
    const actual = JSON.stringify(fast(input));
    if (actual !== expected) return input;
  }
  return null;
}
