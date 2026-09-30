from solution import total_quantity


@test("adds the lines that are whole numbers")
def _():
    expect(total_quantity(["2", "x", "5"])).to_equal(7)


@test("skips blank lines")
def _():
    expect(total_quantity(["", "3"])).to_equal(3)


@test("a negative quantity raises ValueError")
def _():
    expect(lambda: total_quantity(["3", "-1"])).to_raise(ValueError, match="negative")
