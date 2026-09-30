from solution import count_bundles


@test("the example from the statement")
def _():
    expect(count_bundles([4, 1, 7, 3, 2], 6)).to_be(5)


@test("no pair fits")
def _():
    expect(count_bundles([5, 6], 10)).to_be(0)
