from solution import first_repeat


@test("returns the value whose second visit comes first")
def _():
    expect(first_repeat([4, 7, 2, 7, 4])).to_equal(7)


@test("works for text too")
def _():
    expect(first_repeat(["b", "a", "c", "a"])).to_equal("a")


@test("returns None when nothing repeats")
def _():
    expect(first_repeat([1, 2, 3])).to_be_none()


@test("large: finds a repeat at the end of 100,000 readings")
def _():
    values = list(range(100_000))
    values.append(99_999)
    expect(first_repeat(values)).to_equal(99_999)
