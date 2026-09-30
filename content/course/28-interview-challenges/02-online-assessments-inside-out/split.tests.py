from solution import min_split_gap


@test("the example from the statement")
def _():
    expect(min_split_gap([3, 1, 2, 4, 3])).to_be(1)


@test("two entries give exactly one split")
def _():
    expect(min_split_gap([-1000, 1000])).to_be(2000)


@test("all negative entries")
def _():
    expect(min_split_gap([-3, -5, -2, -4])).to_be(2)
    expect(min_split_gap([-10, -1, -1])).to_be(8)


@test("equal entries and duplicates")
def _():
    expect(min_split_gap([5, 5, 5, 5])).to_be(0)
    expect(min_split_gap([7, 7, 7])).to_be(7)


@test("the best split can be the last one")
def _():
    expect(min_split_gap([1, 1, 1, 1, 10])).to_be(6)


@test("large: 100,000 entries at the extremes")
def _():
    entries = [1000 if i % 2 == 0 else -1000 for i in range(100_000)]
    entries[99_999] = 1000
    expect(min_split_gap(entries)).to_be(0)
