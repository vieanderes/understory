from collections import deque


def fewest_steps(grid):
    start = next((r, row.index("S")) for r, row in enumerate(grid) if "S" in row)
    queue = deque([(start[0], start[1], 0)])
    seen = {start}
    while queue:
        row, col, dist = queue.popleft()
        if grid[row][col] == "E":
            return dist
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r, c = row + dr, col + dc
            if 0 <= r < len(grid) and 0 <= c < len(grid[r]) and grid[r][c] != "#" and (r, c) not in seen:
                # Marked when added, so no cell is queued twice.
                seen.add((r, c))
                queue.append((r, c, dist + 1))
    return -1
