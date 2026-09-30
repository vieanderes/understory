# Scan every cell. Each land cell not yet seen starts a new island, and a depth-first
# search with its own stack marks the whole island, so no cell is counted twice.
def count_islands(grid):
    seen = set()
    islands = 0
    for row, line in enumerate(grid):
        for col, cell in enumerate(line):
            if cell != "X" or (row, col) in seen:
                continue
            islands += 1
            seen.add((row, col))
            stack = [(row, col)]
            while stack:
                r, c = stack.pop()
                for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                    if not (0 <= nr < len(grid) and 0 <= nc < len(grid[nr])):
                        continue
                    if grid[nr][nc] != "X" or (nr, nc) in seen:
                        continue
                    seen.add((nr, nc))
                    stack.append((nr, nc))
    return islands
