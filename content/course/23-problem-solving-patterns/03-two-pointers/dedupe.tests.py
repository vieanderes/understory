from solution import remove_duplicates


@test("example from the task")
def _():
    ids = [1, 1, 2, 3, 3]
    count = remove_duplicates(ids)
    expect(count).to_be(3)
    expect(ids[:count]).to_equal([1, 2, 3])


@test("a long run of one value shrinks to one")
def _():
    ids = [4, 4, 4, 4]
    count = remove_duplicates(ids)
    expect(count).to_be(1)
    expect(ids[:count]).to_equal([4])


@test("no duplicates leaves the list as it was")
def _():
    ids = [2, 5, 9]
    expect(remove_duplicates(ids)).to_be(3)
    expect(ids).to_equal([2, 5, 9])


@test("an empty list gives 0")
def _():
    expect(remove_duplicates([])).to_be(0)


@test("works in place, on the same list")
def _():
    ids = [0, 0, 1, 1, 1, 2, 3, 3]
    count = remove_duplicates(ids)
    expect(count).to_be(4)
    expect(ids[:count]).to_equal([0, 1, 2, 3])


@test("performance: 1,000,000 ids with many repeats")
def _():
    ids = [i // 2 for i in range(1_000_000)]
    count = remove_duplicates(ids)
    expect(count).to_be(500_000)
    expect(ids[499_999]).to_be(499_999)
