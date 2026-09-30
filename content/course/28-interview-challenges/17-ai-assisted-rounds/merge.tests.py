from solution import merge_bookings


@test("the example from the task")
def _():
    expect(merge_bookings([[540, 600], [570, 660], [720, 780]])).to_equal([[540, 660], [720, 780]])


@test("no bookings give no blocks")
def _():
    expect(merge_bookings([])).to_equal([])


@test("bookings in any order come out sorted by start")
def _():
    expect(merge_bookings([[1020, 1080], [540, 600], [90, 120]])).to_equal(
        [[90, 120], [540, 600], [1020, 1080]]
    )


@test("a booking inside a longer one after a touch keeps the longer end")
def _():
    expect(merge_bookings([[540, 600], [600, 900], [660, 720]])).to_equal([[540, 900]])


@test("bookings that touch join into one block")
def _():
    expect(merge_bookings([[600, 660], [660, 720]])).to_equal([[600, 720]])


@test("a booking inside a longer one keeps the longer end")
def _():
    expect(merge_bookings([[480, 1020], [540, 600]])).to_equal([[480, 1020]])


@test("the input list is not changed")
def _():
    bookings = [[720, 780], [540, 600]]
    merge_bookings(bookings)
    expect(bookings).to_equal([[720, 780], [540, 600]])


@test("large: 100,000 overlapping bookings in reverse order")
def _():
    bookings = [[i * 2, i * 2 + 3] for i in range(99_999, -1, -1)]
    expect(merge_bookings(bookings)).to_equal([[0, 200_001]])
