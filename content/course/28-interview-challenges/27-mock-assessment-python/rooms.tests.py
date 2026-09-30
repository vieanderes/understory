from solution import rooms_needed


@test("the example from the statement")
def _():
    expect(rooms_needed([30, 0, 60, 10], [75, 40, 90, 20], 10)).to_be(2)


@test("one booking needs one room")
def _():
    expect(rooms_needed([5], [6], 0)).to_be(1)
