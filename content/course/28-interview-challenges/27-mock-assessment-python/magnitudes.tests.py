from solution import distinct_magnitudes


@test("the example from the statement")
def _():
    expect(distinct_magnitudes([-5, -3, -1, 0, 3, 6])).to_be(5)


@test("a single reading")
def _():
    expect(distinct_magnitudes([7])).to_be(1)
