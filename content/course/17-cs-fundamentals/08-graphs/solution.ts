export type Graph = Record<string, string[]>;

// Breadth-first search reaches nodes in order of distance, so the first time it meets
// `to` is by a route with the fewest edges.
export function fewestHops(graph: Graph, from: string, to: string): number {
  const hops: Record<string, number> = {};
  hops[from] = 0;
  const queue: string[] = [from];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head] as string;
    head = head + 1;
    const distance = hops[current] as number;
    if (current === to) return distance;
    for (const next of graph[current] ?? []) {
      if (hops[next] === undefined) {
        hops[next] = distance + 1;
        queue.push(next);
      }
    }
  }
  return -1;
}
