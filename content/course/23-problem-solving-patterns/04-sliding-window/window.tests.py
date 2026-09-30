from solution import max_sum_of_k


@test("example from the task")
def _():
    expect(max_sum_of_k([4, 2, 7, 1, 5], 3)).to_be(13)


@test("the best window can be the last one")
def _():
    expect(max_sum_of_k([1, 1, 1, 9, 9], 2)).to_be(18)


@test("all negative values still give the best window")
def _():
    expect(max_sum_of_k([-5, -2, -8, -1], 2)).to_be(-7)


@test("k equal to the length sums everything")
def _():
    expect(max_sum_of_k([3, 4, 5], 3)).to_be(12)


@test("k larger than the list gives None")
def _():
    expect(max_sum_of_k([3, 4], 5)).to_be_none()


@test("k of zero gives None")
def _():
    expect(max_sum_of_k([3, 4], 0)).to_be_none()


@test("performance: 1,000,000 values, windows of 10,000")
def _():
    values = [(i * 37) % 101 - 50 for i in range(1_000_000)]
    values[999_999] = 1_000_000
    expect(max_sum_of_k(values, 10_000)).to_be(1_000_000)
