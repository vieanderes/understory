from solution import longest_unique


@test("example from the task")
def _():
    expect(longest_unique([3, 1, 4, 1, 5, 9])).to_be(4)


@test("no songs")
def _():
    expect(longest_unique([])).to_be(0)


@test("the same song over and over")
def _():
    expect(longest_unique([7, 7, 7])).to_be(1)


@test("no repeats at all")
def _():
    expect(longest_unique([1, 2, 3, 4])).to_be(4)


@test("a repeat far back in the window")
def _():
    expect(longest_unique([1, 2, 3, 1, 4, 5])).to_be(5)


@test("the best run is at the end")
def _():
    expect(longest_unique([2, 2, 1, 3, 4])).to_be(4)


@test("performance: 200,000 songs")
def _():
    songs = [i % 1000 for i in range(200_000)]
    expect(longest_unique(songs)).to_be(1000)
