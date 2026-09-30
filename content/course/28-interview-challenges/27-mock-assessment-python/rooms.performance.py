# The listing run has no solution loaded, so these tests call the function by name
# from the shared namespace instead of importing it.


def seeded_bookings(n: int, seed: int, span: int, longest: int) -> tuple[list[int], list[int]]:
    starts: list[int] = []
    ends: list[int] = []
    state = seed
    for _ in range(n):
        state = state * 48271 % 2_147_483_647
        start = state % span
        state = state * 48271 % 2_147_483_647
        starts.append(start)
        ends.append(start + 1 + state % longest)
    return starts, ends


@test("large: 100,000 seeded bookings over a year of minutes")
def _():
    starts, ends = seeded_bookings(100_000, 17, 525_600, 240)
    expect(rooms_needed(starts, ends, 15)).to_be(48)


@test("large: 100,000 back-to-back bookings, newest first")
def _():
    starts = list(range(99_999 * 10, -1, -10))
    ends = [start + 10 for start in starts]
    expect(rooms_needed(starts, ends, 0)).to_be(1)


@test("large: 100,000 bookings that all overlap")
def _():
    starts = list(range(100_000))
    ends = [1_000_000_000] * 100_000
    expect(rooms_needed(starts, ends, 0)).to_be(100_000)
