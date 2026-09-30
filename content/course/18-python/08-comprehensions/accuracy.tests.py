from solution import accuracy


@test("returns the share of labels that match")
def _():
    expect(accuracy(["bug", "refund"], ["bug", "other"])).to_equal(0.5)


@test("every label right gives 1.0")
def _():
    expect(accuracy(["a", "b", "c"], ["a", "b", "c"])).to_equal(1.0)


@test("no labels gives 0.0")
def _():
    expect(accuracy([], [])).to_equal(0.0)


@test("lists of different lengths raise ValueError")
def _():
    expect(lambda: accuracy(["a", "b"], ["a"])).to_raise(ValueError)
