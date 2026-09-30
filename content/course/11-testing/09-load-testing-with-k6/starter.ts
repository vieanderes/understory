export function percentile(samples: number[], p: number): number | null {
  // Replace this. It returns the mean, which is what the slow tail hides behind.
  if (samples.length === 0) return null;
  let sum = 0;
  for (const sample of samples) sum += sample;
  return sum / samples.length;
}
