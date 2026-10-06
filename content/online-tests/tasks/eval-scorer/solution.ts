function solution(B: string[], C: string[], D: number): string[] {
  type Row = { slice: string; any: boolean; all: boolean };
  const parse = (entries: string[]): Map<string, Row> => {
    const rows = new Map<string, Row>();
    for (const entry of entries) {
      const [id, slice, trials] = entry.split(' ');
      rows.set(id!, { slice: slice!, any: trials!.includes('P'), all: !trials!.includes('F') });
    }
    return rows;
  };
  const base = parse(B);
  const cand = parse(C);
  const shared = [...cand.keys()].filter((id) => base.has(id));
  const pct = (count: number, total: number): number => Math.floor((100 * count) / total);
  const count = (rows: Map<string, Row>, ids: string[], key: 'any' | 'all'): number =>
    ids.filter((id) => rows.get(id)![key]).length;

  const n = shared.length;
  const summary = [
    `pass@k ${pct(count(base, shared, 'any'), n)} ${pct(count(cand, shared, 'any'), n)}`,
    `pass^k ${pct(count(base, shared, 'all'), n)} ${pct(count(cand, shared, 'all'), n)}`,
  ];
  const bySlice = new Map<string, string[]>();
  for (const id of shared) {
    const slice = cand.get(id)!.slice;
    bySlice.set(slice, [...(bySlice.get(slice) ?? []), id]);
  }
  for (const slice of [...bySlice.keys()].sort()) {
    const ids = bySlice.get(slice)!;
    const before = count(base, ids, 'all');
    const after = count(cand, ids, 'all');
    // Compare the exact fractions by cross-multiplying: (before - after) / n > D / 100.
    if ((before - after) * 100 > D * ids.length) {
      summary.push(`regressed ${slice} ${pct(before, ids.length)} ${pct(after, ids.length)}`);
    }
  }
  if (summary.length === 2) summary.push('no regressions');
  return summary;
}
