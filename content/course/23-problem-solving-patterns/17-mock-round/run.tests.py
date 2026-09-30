from solution import longest_run


@test("example from the task")
def _():
    expect(longest_run([100, 4, 200, 1, 3, 2])).to_be(4)


@test("an empty list has no run")
def _():
    expect(longest_run([])).to_be(0)


@test("a single number is a run of 1")
def _():
    expect(longest_run([7])).to_be(1)


@test("duplicates do not break or lengthen a run")
def _():
    expect(longest_run([1, 2, 2, 3])).to_be(3)


@test("negative numbers and zero count")
def _():
    expect(longest_run([-2, 0, -1, 5, 1])).to_be(4)


@test("performance: one run of 100,000 shuffled numbers")
def _():
    nums = [(i * 7919) % 100_000 for i in range(100_000)]
    expect(longest_run(nums)).to_be(100_000)
