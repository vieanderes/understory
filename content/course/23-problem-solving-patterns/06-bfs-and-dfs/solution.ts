// Scan every cell. Each land cell not yet seen starts a new island, and a depth-first
// search with its own stack marks the whole island, so no cell is counted twice.
export function countIslands(grid: string[]): number {
  const seen = new Set<string>();
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let islands = 0;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < (grid[row] ?? '').length; col++) {
      if (grid[row]?.[col] !== 'X' || seen.has(`${row},${col}`)) continue;
      islands++;
      seen.add(`${row},${col}`);
      const stack = [[row, col]];
      while (stack.length > 0) {
        const [r, c] = stack.pop() as number[];
        for (const [dr, dc] of steps) {
          const nr = (r as number) + (dr as number);
          const nc = (c as number) + (dc as number);
          const key = `${nr},${nc}`;
          if (grid[nr]?.[nc] !== 'X' || seen.has(key)) continue;
          seen.add(key);
          stack.push([nr, nc]);
        }
      }
    }
  }
  return islands;
}
