from solution import largest_k


@test("the examples from the task")
def _():
    expect(largest_k([3, 2, -2, 5, -3])).to_be(3)
    expect(largest_k([1, 2, 3, -4])).to_be(0)


@test("zero is not a K, since K must be above 0")
def _():
    expect(largest_k([0, 0])).to_be(0)
    expect(largest_k([0, 4, -4])).to_be(4)


@test("duplicates count once")
def _():
    expect(largest_k([2, 2, -2, -2])).to_be(2)


@test("several pairs give the largest")
def _():
    expect(largest_k([1, -1, 7, -7, 4, -4])).to_be(7)


@test("a negative without its positive is not a pair")
def _():
    expect(largest_k([-5, -6, 6])).to_be(6)
    expect(largest_k([-9, 1])).to_be(0)


@test("one number and an empty list give 0")
def _():
    expect(largest_k([5])).to_be(0)
    expect(largest_k([])).to_be(0)


@test("performance: 100,000 numbers with the pair at the far ends")
def _():
    values = list(range(1, 100_001))
    values[0] = -100_000
    expect(largest_k(values)).to_be(100_000)
