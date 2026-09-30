from solution import longest_streak


@test("example from the task")
def _():
    expect(longest_streak([12000, 9000, 11000, 13000, 10500], 10000)).to_be(3)


@test("no days give 0")
def _():
    expect(longest_streak([], 10000)).to_be(0)


@test("no good days give 0")
def _():
    expect(longest_streak([4000, 9999], 10000)).to_be(0)


@test("exactly the goal counts")
def _():
    expect(longest_streak([10000, 10000], 10000)).to_be(2)


@test("a run that reaches the last day")
def _():
    expect(longest_streak([12000, 500, 11000, 11000, 11000], 10000)).to_be(3)


@test("every day on target")
def _():
    expect(longest_streak([10500, 12000, 15000], 10000)).to_be(3)


@test("the list is left as it was")
def _():
    steps = [12000, 3000]
    longest_streak(steps, 10000)
    expect(steps).to_equal([12000, 3000])


@test("performance: 200,000 days, all on target")
def _():
    steps = [10000 + i % 500 for i in range(200_000)]
    expect(longest_streak(steps, 10000)).to_be(200_000)
