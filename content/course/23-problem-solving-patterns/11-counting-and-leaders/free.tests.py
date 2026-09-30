from solution import first_free_number


@test("example from the task")
def _():
    expect(first_free_number([3, 1, 6, 4, 1, 2])).to_be(5)


@test("every number in use: the next one")
def _():
    expect(first_free_number([1, 2, 3])).to_be(4)


@test("an empty list starts at 1")
def _():
    expect(first_free_number([])).to_be(1)


@test("only negatives and zero")
def _():
    expect(first_free_number([-1, -3, 0])).to_be(1)


@test("huge numbers are no help")
def _():
    expect(first_free_number([1_000_000, 2, 1])).to_be(3)


@test("1 to 10 in order")
def _():
    expect(first_free_number([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).to_be(11)


@test("the list is left as it was")
def _():
    used = [3, 1, 2]
    first_free_number(used)
    expect(used).to_equal([3, 1, 2])


@test("performance: 300,000 numbers, all in use")
def _():
    n = 300_000
    used = [(i * 7919) % n + 1 for i in range(n)]
    expect(first_free_number(used)).to_be(n + 1)
