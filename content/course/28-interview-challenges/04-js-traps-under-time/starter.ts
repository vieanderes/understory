// This passed a quick check with single-digit scores. Fix it for the hidden tests.
export function topDistinct(scores: number[], k: number): number[] {
  const distinct = scores.filter((score, i) => scores.indexOf(score) === i);
  return distinct.sort().reverse().slice(0, k);
}
