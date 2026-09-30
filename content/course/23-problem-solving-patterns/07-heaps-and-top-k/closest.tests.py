from solution import k_closest


@test("example from the task")
def _():
    expect(k_closest([(3, 4), (1, 1), (-2, 0), (5, 5)], 2)).to_equal([1, 2])


@test("k of 0 gives no stores")
def _():
    expect(k_closest([(1, 1)], 0)).to_equal([])


@test("k bigger than the list gives every store, nearest first")
def _():
    expect(k_closest([(5, 0), (0, 1), (2, 2)], 10)).to_equal([1, 2, 0])


@test("a tie goes to the lower index")
def _():
    expect(k_closest([(0, 2), (2, 0), (0, -2), (9, 9)], 2)).to_equal([0, 1])


@test("no stores")
def _():
    expect(k_closest([], 3)).to_equal([])


@test("performance: 200,000 stores, k of 1,000")
def _():
    stores = [((i * 7919) % 20_001 - 10_000, (i * 104_729) % 20_001 - 10_000) for i in range(200_000)]
    result = k_closest(stores, 1000)
    expect(len(result)).to_be(1000)
    worst = max(stores[i][0] ** 2 + stores[i][1] ** 2 for i in result)
    better = sum(1 for x, y in stores if x * x + y * y < worst)
    assert better <= 1000, "a nearer store was left out"
