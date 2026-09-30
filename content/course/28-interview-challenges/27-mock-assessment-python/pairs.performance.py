# The listing run has no solution loaded, so these tests call the function by name
# from the shared namespace instead of importing it.


@test("large: 100,000 seeded prices")
def _():
    prices: list[int] = []
    state = 99
    for _ in range(100_000):
        state = state * 48271 % 2_147_483_647
        prices.append(state % 2_000_001 - 1_000_000)
    expect(count_bundles(prices, 250_000)).to_be(3_076_581_423)


@test("large: 100,000 equal prices, every pair fits")
def _():
    # 100,000 * 99,999 / 2 pairs: far past 2^31, and Python's int holds it exactly.
    expect(count_bundles([0] * 100_000, 0)).to_be(4_999_950_000)


@test("large: 100,000 falling prices")
def _():
    prices = list(range(100_000, 0, -1))
    expect(count_bundles(prices, 100_000)).to_be(2_499_950_000)
