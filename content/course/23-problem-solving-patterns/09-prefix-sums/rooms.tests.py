from solution import rooms_per_night


@test("example from the task")
def _():
    expect(rooms_per_night(4, [(0, 1), (1, 3)])).to_equal([1, 2, 1, 1])


@test("no bookings leave every night empty")
def _():
    expect(rooms_per_night(3, [])).to_equal([0, 0, 0])


@test("zero nights give an empty list")
def _():
    expect(rooms_per_night(0, [])).to_equal([])


@test("a one-night booking")
def _():
    expect(rooms_per_night(3, [(1, 1)])).to_equal([0, 1, 0])


@test("a booking on the last night")
def _():
    expect(rooms_per_night(3, [(0, 2), (2, 2)])).to_equal([1, 1, 2])


@test("identical bookings stack up")
def _():
    expect(rooms_per_night(2, [(0, 1), (0, 1), (0, 1)])).to_equal([3, 3])


@test("performance: 100,000 nights and 100,000 long bookings")
def _():
    n = 100_000
    bookings = [(i % 100, n - 1 - (i % 100)) for i in range(n)]
    rooms = rooms_per_night(n, bookings)
    assert len(rooms) == n
    assert rooms[0] == 1000
    assert rooms[n // 2] == n
    assert rooms[n - 1] == 1000
