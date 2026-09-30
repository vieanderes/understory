export interface Result {
  name: string;
  points: number;
}

// Each rule in the statement is one line here, so a reviewer can tick them off.
export function leaderboard(results: Result[], n: number): string[] {
  const totals = new Map<string, number>();
  for (const { name, points } of results) {
    totals.set(name, (totals.get(name) ?? 0) + points);
  }
  return [...totals]
    .sort(([nameA, totalA], [nameB, totalB]) => {
      if (totalA !== totalB) return totalB - totalA;
      // "Ascending string order" compares code units, so capitals come first.
      return nameA < nameB ? -1 : 1;
    })
    .slice(0, n)
    .map(([name, total]) => `${name}(${total})`);
}
