from solution import count_islands


@test("an empty map has no islands")
def _():
    expect(count_islands([])).to_be(0)


@test("a map of only water has no islands")
def _():
    expect(count_islands(["...", "..."])).to_be(0)


@test("touching land cells make one island")
def _():
    expect(count_islands(["XX.", "X..", "..."])).to_be(1)


@test("cells that touch only at a corner are separate islands")
def _():
    expect(count_islands(["X.", ".X"])).to_be(2)


@test("it counts several islands of different shapes")
def _():
    expect(count_islands(["XX..X", "....X", ".X...", ".XX.X"])).to_be(4)


@test("it leaves the map unchanged")
def _():
    grid = ["X.X", ".X."]
    count_islands(grid)
    expect(grid).to_equal(["X.X", ".X."])


@test("performance: one 300 by 300 island")
def _():
    big = ["X" * 300 for _ in range(300)]
    expect(count_islands(big)).to_be(1)
