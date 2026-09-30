from solution import two_sum


def check_pair(prices, target, pair):
    assert pair is not None, "expected a pair, got None"
    i, j = pair
    assert i < j, f"expected i < j, got {pair}"
    assert prices[i] + prices[j] == target, f"{prices[i]} + {prices[j]} is not {target}"


@test("example from the task")
def _():
    expect(two_sum([3, 8, 4, 6], 10)).to_equal([2, 3])


@test("no pair gives None")
def _():
    expect(two_sum([1, 2, 3], 100)).to_be_none()


@test("an empty list gives None")
def _():
    expect(two_sum([], 5)).to_be_none()


@test("one price at half the target can't pair with itself")
def _():
    expect(two_sum([5, 1], 10)).to_be_none()


@test("two equal prices can pair")
def _():
    check_pair([5, 1, 5], 10, two_sum([5, 1, 5], 10))


@test("negative prices, as refunds")
def _():
    check_pair([-3, 7, 2], 4, two_sum([-3, 7, 2], 4))


@test("performance: 100,000 prices, pair at the very end")
def _():
    prices = list(range(1, 100_001))
    expect(two_sum(prices, 10**9)).to_be_none()
    check_pair(prices + [10**9 - 1], 10**9, two_sum(prices + [10**9 - 1], 10**9))
