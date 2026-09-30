// A Set drops repeats in one O(n) pass, where indexOf inside filter was O(n²). The
// comparator makes sort numeric: without it, 100 sorts before 9 because "1" < "9".
export function topDistinct(scores: number[], k: number): number[] {
  const distinct = [...new Set(scores)];
  distinct.sort((a, b) => b - a);
  return distinct.slice(0, k);
}
