from solution import count_routes


@test("example from the task")
def _():
    expect(count_routes(["...", ".#.", "..."])).to_be(2)


@test("one cell is one route")
def _():
    expect(count_routes(["."])).to_be(1)


@test("a shelf on the start means no routes")
def _():
    expect(count_routes(["#.", ".."])).to_be(0)


@test("a shelf on the goal means no routes")
def _():
    expect(count_routes(["..", ".#"])).to_be(0)


@test("a single row has one route")
def _():
    expect(count_routes(["....."])).to_be(1)


@test("an open 3 by 3 floor")
def _():
    expect(count_routes(["...", "...", "..."])).to_be(6)


@test("performance: an open 60 by 60 floor")
def _():
    expect(count_routes(["." * 60] * 60)).to_be(24356699707654619143838606602026720)
