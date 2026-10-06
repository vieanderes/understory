function solution(P: number[][], F: number[][], Q: number, T: number): string[] {
  // Correct, but every lookup scans the other list: O(N * M).
  const latest = (rows: number[][]): number[][] => {
    const out: number[][] = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!out.some((r) => r[0] === rows[i]![0])) out.push(rows[i]!);
    }
    return out;
  };
  const before = latest(P);
  const after = latest(F);
  const created: number[] = [];
  const updated: number[] = [];
  for (const [id, hash] of after) {
    const old = before.find((r) => r[0] === id);
    if (old === undefined) created.push(id!);
    else if (old[1] !== hash) updated.push(id!);
  }
  const deleted: number[] = [];
  for (const [id] of before) if (!after.some((r) => r[0] === id)) deleted.push(id!);
  const ascending = (a: number, b: number): number => a - b;
  const changes = [
    ...created.sort(ascending).map((id) => `create ${id}`),
    ...updated.sort(ascending).map((id) => `update ${id}`),
  ];
  if (before.length > T && after.length * 100 < Q * before.length) {
    changes.push(`abort ${deleted.length}`);
  } else {
    changes.push(...deleted.sort(ascending).map((id) => `delete ${id}`));
  }
  return changes;
}
