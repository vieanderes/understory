# The listing run has no solution loaded, so these tests call the function by name
# from the shared namespace instead of importing it.


@test("back to back with no cleaning share a room")
def _():
    expect(rooms_needed([0, 10, 20], [10, 20, 30], 0)).to_be(1)


@test("back to back with cleaning need two rooms")
def _():
    expect(rooms_needed([0, 10, 20], [10, 20, 30], 1)).to_be(2)


@test("a gap exactly as long as the cleaning is enough")
def _():
    expect(rooms_needed([0, 15], [10, 25], 5)).to_be(1)
    expect(rooms_needed([0, 14], [10, 25], 5)).to_be(2)


@test("identical bookings each need a room")
def _():
    expect(rooms_needed([3, 3, 3, 3], [8, 8, 8, 8], 0)).to_be(4)


@test("nested bookings")
def _():
    expect(rooms_needed([0, 1, 2], [100, 50, 3], 0)).to_be(3)


@test("bookings given out of order")
def _():
    expect(rooms_needed([50, 0, 25, 75], [60, 10, 35, 85], 15)).to_be(1)
    expect(rooms_needed([50, 0, 25, 75], [60, 10, 35, 85], 16)).to_be(2)


@test("a room freed early is reused before one freed late")
def _():
    # Comparing with the latest booking, or the latest end, would open a third room.
    expect(rooms_needed([0, 1, 5], [100, 4, 9], 0)).to_be(2)


@test("the extremes of the value range")
def _():
    top = 1_000_000_000
    expect(rooms_needed([0, top - 1], [top - 1, top], 1_000_000)).to_be(2)
    expect(rooms_needed([0, top - 1], [top - 1_000_001, top], 1_000_000)).to_be(1)


@test("the input lists are left as they were")
def _():
    starts, ends = [20, 0], [30, 10]
    rooms_needed(starts, ends, 0)
    expect(starts).to_equal([20, 0])
    expect(ends).to_equal([30, 10])


@test("a medium mixed input matches a direct count")
def _():
    starts: list[int] = []
    ends: list[int] = []
    state = 3
    for _ in range(300):
        state = state * 48271 % 2_147_483_647
        start = state % 1000
        state = state * 48271 % 2_147_483_647
        starts.append(start)
        ends.append(start + 1 + state % 60)
    expected = max(
        sum(1 for s, e in zip(starts, ends) if s <= t < e + 7) for t in starts
    )
    expect(rooms_needed(starts, ends, 7)).to_be(expected)
