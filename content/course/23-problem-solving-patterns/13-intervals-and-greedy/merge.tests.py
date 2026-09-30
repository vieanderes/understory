from solution import merge_bookings


@test("no bookings give no blocks")
def _():
    expect(merge_bookings([])).to_equal([])


@test("example from the task")
def _():
    expect(merge_bookings([[8, 10], [1, 3], [2, 6]])).to_equal([[1, 6], [8, 10]])


@test("touching bookings merge into one block")
def _():
    expect(merge_bookings([[3, 5], [1, 3]])).to_equal([[1, 5]])


@test("a booking inside another keeps the longer end")
def _():
    expect(merge_bookings([[1, 10], [2, 3], [4, 6]])).to_equal([[1, 10]])


@test("separate bookings stay apart and the input is untouched")
def _():
    bookings = [[5, 6], [1, 2]]
    expect(merge_bookings(bookings)).to_equal([[1, 2], [5, 6]])
    expect(bookings).to_equal([[5, 6], [1, 2]])


@test("performance: 200,000 bookings in reverse order")
def _():
    bookings = []
    for i in range(99_999, -1, -1):
        bookings.append([i * 10, i * 10 + 5])
        bookings.append([i * 10 + 3, i * 10 + 8])
    result = merge_bookings(bookings)
    expect(result).to_have_length(100_000)
    expect(result[0]).to_equal([0, 8])
    expect(result[99_999]).to_equal([999_990, 999_998])
