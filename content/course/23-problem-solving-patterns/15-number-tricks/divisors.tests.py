from solution import grid_count


@test("example from the task")
def _():
    expect(grid_count(24)).to_be(8)


@test("one photo fits one grid")
def _():
    expect(grid_count(1)).to_be(1)


@test("a prime has two grids")
def _():
    expect(grid_count(13)).to_be(2)


@test("a perfect square counts its root once")
def _():
    expect(grid_count(36)).to_be(9)


@test("a power of two")
def _():
    expect(grid_count(1024)).to_be(11)


@test("performance: the largest n")
def _():
    expect(grid_count(2_147_483_647)).to_be(2)
    expect(grid_count(2_147_395_600)).to_be(135)
