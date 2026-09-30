export function countIslands(grid: string[]): number {
  // Target O(rows × columns): each unseen 'X' starts a new island; mark all of it with your own stack.
  return grid.length === 0 ? 0 : -1;
}
