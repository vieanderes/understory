from solution import days_to_wait


@test("example from the task")
def _():
    expect(days_to_wait([13, 14, 12, 11, 15])).to_equal([1, 3, 2, 1, 0])


@test("a day with no warmer day after it waits 0")
def _():
    expect(days_to_wait([20, 18, 16])).to_equal([0, 0, 0])


@test("an equal temperature is not warmer")
def _():
    expect(days_to_wait([15, 15, 16])).to_equal([2, 1, 0])


@test("no days give an empty list")
def _():
    expect(days_to_wait([])).to_equal([])


@test("one day waits 0")
def _():
    expect(days_to_wait([9])).to_equal([0])


@test("performance: 100,000 falling days, then one warm day")
def _():
    n = 100_000
    temps = [n - i for i in range(n)] + [n + 1]
    wait = days_to_wait(temps)
    expect(wait[0]).to_be(n)
    expect(wait[n - 1]).to_be(1)
    expect(wait[n]).to_be(0)


@test("a flat week never gets warmer")
def _():
    expect(days_to_wait([7, 7, 7, 7])).to_equal([0, 0, 0, 0])
