from solution import fewest_steps


@test("example from the task")
def _():
    expect(fewest_steps(["S.#", "..#", "#.E"])).to_be(4)


@test("the exit is walled in")
def _():
    expect(fewest_steps(["S.#", "..#", "##E"])).to_be(-1)


@test("the exit is next to the start")
def _():
    expect(fewest_steps(["SE"])).to_be(1)


@test("a long way round a wall")
def _():
    expect(fewest_steps(["S#E", ".#.", "..."])).to_be(6)


@test("the grid is left as it was")
def _():
    grid = ["S.", ".E"]
    fewest_steps(grid)
    expect(grid).to_equal(["S.", ".E"])


@test("performance: an open 300 by 300 floor")
def _():
    grid = ["." * 300 for _ in range(300)]
    grid[0] = "S" + grid[0][1:]
    grid[299] = grid[299][:299] + "E"
    expect(fewest_steps(grid)).to_be(598)
