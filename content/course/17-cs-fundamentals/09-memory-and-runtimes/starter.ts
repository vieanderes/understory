export type Heap = Record<string, string[]>;

export function garbage(heap: Heap, roots: string[]): string[] {
  // Mark everything you can reach from the roots. What's left over is garbage.
  return Object.keys(heap)
    .filter((id) => !roots.includes(id))
    .sort();
}
