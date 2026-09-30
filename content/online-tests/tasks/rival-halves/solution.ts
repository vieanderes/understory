function leaders(values: number[]): { has: Uint8Array; value: number[] } {
  // If a prefix has a leader, the running Boyer-Moore candidate is that leader, so one
  // pass with a count per value tells, for every prefix, whether it has one and which.
  const n = values.length;
  const has = new Uint8Array(n);
  const value = new Array<number>(n).fill(0);
  const counts = new Map<number, number>();
  let candidate = 0;
  let votes = 0;
  for (let i = 0; i < n; i++) {
    const x = values[i]!;
    counts.set(x, (counts.get(x) ?? 0) + 1);
    if (votes === 0) {
      candidate = x;
      votes = 1;
    } else {
      votes += x === candidate ? 1 : -1;
    }
    if ((counts.get(candidate) ?? 0) * 2 > i + 1) {
      has[i] = 1;
      value[i] = candidate;
    }
  }
  return { has, value };
}

function solution(A: number[]): number {
  // Leaders of every prefix, and of every suffix by running the same pass backwards: O(N).
  const n = A.length;
  const left = leaders(A);
  const right = leaders(A.slice().reverse());
  let splits = 0;
  for (let s = 0; s + 1 < n; s++) {
    const r = n - 2 - s;
    if (left.has[s] && right.has[r] && left.value[s] !== right.value[r]) splits++;
  }
  return splits;
}
