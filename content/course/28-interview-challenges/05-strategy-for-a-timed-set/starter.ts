export function stressTest<I, O>(
  fast: (input: I) => O,
  slow: (input: I) => O,
  generate: () => I,
  runs: number,
): I | null {
  // Run up to `runs` times: make an input, call both, return the input if they disagree.
  return null;
}
