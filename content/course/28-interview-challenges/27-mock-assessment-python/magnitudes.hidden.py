# The listing run has no solution loaded, so these tests call the function by name
# from the shared namespace instead of importing it.


@test("one reading of zero")
def _():
    expect(distinct_magnitudes([0])).to_be(1)


@test("every reading is the same")
def _():
    expect(distinct_magnitudes([4, 4, 4, 4])).to_be(1)


@test("each value with its negative")
def _():
    expect(distinct_magnitudes([-2, 2, -9, 9, 0, 0])).to_be(3)


@test("all negative")
def _():
    expect(distinct_magnitudes([-1, -2, -3, -2])).to_be(3)


@test("sorted and reverse sorted")
def _():
    expect(distinct_magnitudes([-4, -1, 0, 1, 4, 5])).to_be(4)
    expect(distinct_magnitudes([5, 4, 1, 0, -1, -4])).to_be(4)


@test("the extremes of the value range")
def _():
    # abs(-2,147,483,648) is 2,147,483,648, one more than the largest positive value.
    expect(distinct_magnitudes([-2_147_483_648, 2_147_483_647])).to_be(2)
    expect(distinct_magnitudes([-2_147_483_647, 2_147_483_647])).to_be(1)


@test("zero and one are different magnitudes")
def _():
    expect(distinct_magnitudes([0, 1, -1, 0])).to_be(2)


@test("the input is left as it was")
def _():
    readings = [3, -3, 1]
    distinct_magnitudes(readings)
    expect(readings).to_equal([3, -3, 1])


@test("a medium mixed input matches a direct count")
def _():
    readings: list[int] = []
    state = 11
    for _ in range(500):
        state = state * 48271 % 2_147_483_647
        readings.append(state % 201 - 100)
    expected = len(set(abs(value) for value in readings))
    expect(distinct_magnitudes(readings)).to_be(expected)
