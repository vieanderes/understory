from solution import best_streak


@test("example from the task")
def _():
    expect(best_streak([2, -5, 3, 4, -1])).to_be(7)


@test("all losses give the smallest loss")
def _():
    expect(best_streak([-3, -1, -2])).to_be(-1)


@test("one day is its own best run")
def _():
    expect(best_streak([-4])).to_be(-4)
    expect(best_streak([6])).to_be(6)


@test("a dip worth crossing joins two gains")
def _():
    expect(best_streak([5, -2, 6, -10, 3])).to_be(9)


@test("the whole list can be the best run")
def _():
    expect(best_streak([1, 2, 3])).to_be(6)


@test("performance: 300,000 days of gains and losses")
def _():
    changes = [-5 if i % 3 == 0 else 3 for i in range(300_000)]
    expect(best_streak(changes)).to_be(100_005)


@test("the list is left as it was")
def _():
    changes = [4, -1, 2]
    best_streak(changes)
    expect(changes).to_equal([4, -1, 2])
