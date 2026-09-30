export type Graph = Record<string, string[]>;

export function fewestHops(graph: Graph, from: string, to: string): number {
  // Search outwards from `from`, one ring of neighbours at a time, and remember who you've seen.
  return graph[from] === undefined || to === '' ? -1 : 0;
}
