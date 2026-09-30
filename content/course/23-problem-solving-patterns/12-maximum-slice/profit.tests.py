from solution import max_profit


@test("example from the task")
def _():
    expect(max_profit([7, 1, 5, 3, 6, 4])).to_be(5)


@test("an empty list makes nothing")
def _():
    expect(max_profit([])).to_be(0)


@test("falling prices make nothing")
def _():
    expect(max_profit([9, 7, 4, 1])).to_be(0)


@test("the highest price comes first")
def _():
    expect(max_profit([9, 2, 5])).to_be(3)


@test("the lowest price comes last")
def _():
    expect(max_profit([3, 8, 1])).to_be(5)


@test("one price makes nothing")
def _():
    expect(max_profit([5])).to_be(0)


@test("performance: 100,000 prices")
def _():
    prices = [100_000 - i for i in range(100_000)] + [50_000, 200_000]
    expect(max_profit(prices)).to_be(199_999)
