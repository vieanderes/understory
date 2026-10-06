function solution(P: number[][], F: number[][], Q: number, T: number): string[] {
  // Index each list by id once. A Map keeps the last row for a repeated id, and makes every
  // lookup O(1), so the whole diff is O(N + M) plus sorting the ids it reports.
  const before = new Map<number, number>();
  for (const [id, hash] of P) before.set(id!, hash!);
  const after = new Map<number, number>();
  for (const [id, hash] of F) after.set(id!, hash!);

  const created: number[] = [];
  const updated: number[] = [];
  for (const [id, hash] of after) {
    const old = before.get(id);
    if (old === undefined) created.push(id);
    else if (old !== hash) updated.push(id);
  }
  const deleted: number[] = [];
  for (const id of before.keys()) if (!after.has(id)) deleted.push(id);

  const ascending = (a: number, b: number): number => a - b;
  const changes = [
    ...created.sort(ascending).map((id) => `create ${id}`),
    ...updated.sort(ascending).map((id) => `update ${id}`),
  ];
  // Integer cross-multiplication keeps the percentage test exact.
  const suspicious = before.size > T && after.size * 100 < Q * before.size;
  if (suspicious) changes.push(`abort ${deleted.length}`);
  else changes.push(...deleted.sort(ascending).map((id) => `delete ${id}`));
  return changes;
}
