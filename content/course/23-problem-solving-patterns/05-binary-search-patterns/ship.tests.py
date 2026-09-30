from solution import min_ship_capacity


@test("example from the task")
def _():
    expect(min_ship_capacity([3, 2, 2, 4, 1, 4], 3)).to_be(6)


@test("works on a longer list")
def _():
    expect(min_ship_capacity([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).to_be(15)


@test("never goes below the heaviest parcel")
def _():
    expect(min_ship_capacity([10, 1, 1], 3)).to_be(10)


@test("one day means shipping everything at once")
def _():
    expect(min_ship_capacity([4, 5, 6], 1)).to_be(15)


@test("more days than parcels needs only the heaviest")
def _():
    expect(min_ship_capacity([4, 5, 6], 10)).to_be(6)


@test("no parcels needs no capacity")
def _():
    expect(min_ship_capacity([], 2)).to_be(0)


# 100,000 parcels, not the 500,000 of the JavaScript version: Python loops are slower,
# and the run must still finish in the time a phone allows. Trying every capacity in
# turn still runs out of time here.
@test("performance: 100,000 parcels")
def _():
    weights = [i % 1000 + 1 for i in range(100_000)]
    expect(min_ship_capacity(weights, 1000)).to_be(50_325)
    expect(min_ship_capacity(weights, 1)).to_be(50_050_000)
