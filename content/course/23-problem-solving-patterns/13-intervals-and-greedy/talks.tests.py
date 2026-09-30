from solution import most_talks


@test("example from the task")
def _():
    expect(most_talks([(1, 4), (2, 3), (3, 5), (6, 7)])).to_be(3)


@test("no talks")
def _():
    expect(most_talks([])).to_be(0)


@test("a long talk that starts first blocks the rest")
def _():
    expect(most_talks([(0, 100), (1, 2), (3, 4), (5, 6)])).to_be(3)


@test("a talk can start when the last one ends")
def _():
    expect(most_talks([(1, 2), (2, 3), (3, 4)])).to_be(3)


@test("identical talks count once")
def _():
    expect(most_talks([(1, 5), (1, 5), (1, 5)])).to_be(1)


@test("the list is left as it was")
def _():
    talks = [(5, 6), (1, 2)]
    most_talks(talks)
    expect(talks).to_equal([(5, 6), (1, 2)])


@test("performance: 100,000 talks")
def _():
    talks = [(i * 10 + (i % 3), i * 10 + 12) for i in range(100_000)]
    talks.reverse()
    expect(most_talks(talks)).to_be(66_666)
