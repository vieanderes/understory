from solution import range_totals


@test("example from the task")
def _():
    expect(range_totals([3, 1, 4, 1, 5], [(1, 3), (0, 4)])).to_equal([6, 14])


@test("a range can start on day 0")
def _():
    expect(range_totals([3, 1, 4, 1, 5], [(0, 2), (0, 0)])).to_equal([8, 3])


@test("a range of one day is that day")
def _():
    expect(range_totals([3, 1, 4, 1, 5], [(4, 4), (2, 2)])).to_equal([5, 4])


@test("negative values are counted")
def _():
    expect(range_totals([-2, 5, -3, 4], [(0, 3), (1, 2)])).to_equal([4, 2])


@test("no queries give an empty list")
def _():
    expect(range_totals([1, 2, 3], [])).to_equal([])


@test("the same range asked twice gives the same answer")
def _():
    expect(range_totals([2, 2, 2], [(0, 2), (0, 2)])).to_equal([6, 6])


@test("performance: 100,000 days and 100,000 wide queries")
def _():
    n = 100_000
    steps = [(i * 7) % 11 for i in range(n)]
    queries = [(i % 1000, n - 1 - i % 1000) for i in range(n)]
    answers = range_totals(steps, queries)
    expect(answers).to_have_length(n)
    expect(answers[0]).to_be(500_001)
    expect(answers[999]).to_be(490_007)
