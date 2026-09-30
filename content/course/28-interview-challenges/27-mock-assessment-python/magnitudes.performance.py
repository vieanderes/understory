# The listing run has no solution loaded, so these tests call the function by name
# from the shared namespace instead of importing it.


@test("large: 100,000 readings, all different")
def _():
    # Steps of 40,000 from the bottom of the range: no two share a magnitude.
    readings = list(range(-2_000_000_000, 2_000_000_000, 40_000))
    expect(distinct_magnitudes(readings)).to_be(50_001)


@test("large: 100,000 readings, each with its negative")
def _():
    readings = [value for i in range(50_000) for value in (i * 7, -i * 7)]
    expect(distinct_magnitudes(readings)).to_be(50_000)


@test("large: 100,000 seeded readings across the whole range")
def _():
    readings: list[int] = []
    state = 2024
    for _ in range(100_000):
        state = state * 48271 % 2_147_483_647
        readings.append(state - 1_073_741_824)
    expect(distinct_magnitudes(readings)).to_be(99_998)
