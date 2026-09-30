from solution import network_rank


@test("the example from the task")
def _():
    expect(network_rank([1, 2, 3, 3], [2, 3, 1, 4], 4)).to_be(4)


@test("the road between a pair counts once")
def _():
    expect(network_rank([1], [2], 2)).to_be(1)


@test("two separate chains")
def _():
    expect(network_rank([1, 2, 4, 5], [2, 3, 5, 6], 6)).to_be(2)


@test("no roads give 0")
def _():
    expect(network_rank([], [], 3)).to_be(0)


@test("a road listed from either end counts the same")
def _():
    expect(network_rank([2, 3, 1], [1, 1, 4], 4)).to_be(3)


@test("performance: one hub joined to 100,000 cities")
def _():
    to = list(range(2, 100_002))
    from_ = [1] * len(to)
    expect(network_rank(from_, to, 100_001)).to_be(100_000)
