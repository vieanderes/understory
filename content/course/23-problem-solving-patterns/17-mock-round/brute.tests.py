from solution import longest_run


@test("example from the task")
def _():
    expect(longest_run([100, 4, 200, 1, 3, 2])).to_be(4)


@test("an empty list gives 0")
def _():
    expect(longest_run([])).to_be(0)


@test("repeats neither break nor lengthen a run")
def _():
    expect(longest_run([1, 2, 2, 3])).to_be(3)


@test("negatives and zero are normal numbers")
def _():
    expect(longest_run([-2, 0, -1, 5, 1])).to_be(4)


@test("one number")
def _():
    expect(longest_run([7])).to_be(1)


@test("the list is left as it was")
def _():
    nums = [3, 1, 2]
    longest_run(nums)
    expect(nums).to_equal([3, 1, 2])


@test("performance: 100,000 numbers")
def _():
    nums = [(i * 7919) % 100_000 for i in range(100_000)]
    expect(longest_run(nums)).to_be(100_000)
