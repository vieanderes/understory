export type Heap = Record<string, string[]>;

// The mark phase of a tracing collector: everything reachable from the roots is live,
// and whatever is left is garbage, even if garbage objects point at each other.
export function garbage(heap: Heap, roots: string[]): string[] {
  const live: string[] = [];
  const toVisit: string[] = [...roots];
  while (toVisit.length > 0) {
    const id = toVisit.pop() as string;
    if (heap[id] !== undefined && !live.includes(id)) {
      live.push(id);
      for (const next of heap[id]) toVisit.push(next);
    }
  }
  return Object.keys(heap)
    .filter((id) => !live.includes(id))
    .sort();
}
