function solution(A: number[], K: number): number[] {
  // Only K mod N moves matter, and a negative K is the same as N - |K| mod N to the right.
  const n = A.length;
  if (n === 0) return [];
  const shift = ((K % n) + n) % n;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[(i + shift) % n] = A[i]!;
  return out;
}
