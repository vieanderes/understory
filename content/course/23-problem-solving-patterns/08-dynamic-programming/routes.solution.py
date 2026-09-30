def count_routes(grid):
    if not grid or grid[0][0] == "#":
        return 0
    cols = len(grid[0])
    # One row of the table is enough: before the update, routes[c] still holds the
    # count for the cell above.
    routes = [0] * cols
    routes[0] = 1
    for line in grid:
        for c in range(cols):
            if line[c] == "#":
                routes[c] = 0
            elif c > 0:
                routes[c] += routes[c - 1]
    return routes[-1]
