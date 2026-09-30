# The listing run has no solution loaded, so these tests call the function by name
# from the shared namespace instead of importing it.


@test("one item makes no pair")
def _():
    expect(count_bundles([1], 100)).to_be(0)


@test("an item is never paired with itself")
def _():
    expect(count_bundles([2, 5], 4)).to_be(0)
    expect(count_bundles([2, 2], 4)).to_be(1)


@test("a sum equal to K counts")
def _():
    expect(count_bundles([3, 3, 3], 6)).to_be(3)


@test("every pair fits")
def _():
    expect(count_bundles([1, 2, 3, 4, 5], 100)).to_be(10)


@test("negative values and a negative K")
def _():
    expect(count_bundles([-5, -1, 2, -3], -4)).to_be(3)


@test("duplicates on both sides of the limit")
def _():
    expect(count_bundles([1, 1, 4, 4, 4], 5)).to_be(7)


@test("sorted and reverse sorted")
def _():
    expect(count_bundles([1, 2, 3, 4, 5, 6], 7)).to_be(9)
    expect(count_bundles([6, 5, 4, 3, 2, 1], 7)).to_be(9)


@test("the extremes of the value range")
def _():
    big = 1_000_000_000
    expect(count_bundles([big, big, -big], 0)).to_be(2)
    expect(count_bundles([big, big], 1_000_000_000)).to_be(0)
    expect(count_bundles([-big, -big], -1_000_000_000)).to_be(1)


@test("a medium mixed input matches a direct count")
def _():
    prices: list[int] = []
    state = 5
    for _ in range(400):
        state = state * 48271 % 2_147_483_647
        prices.append(state % 101 - 50)
    expected = sum(
        1
        for p in range(len(prices))
        for q in range(p + 1, len(prices))
        if prices[p] + prices[q] <= 3
    )
    expect(count_bundles(prices, 3)).to_be(expected)
