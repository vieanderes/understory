from solution import free_rooms


@test("a room with no bookings is free")
def _():
    expect(free_rooms(["A1"], [], 3, 5)).to_equal(["A1"])


@test("a booking inside the stay takes the room")
def _():
    bookings = [{"room": "A1", "start": 4, "end": 6}]
    expect(free_rooms(["A1", "B2"], bookings, 3, 8)).to_equal(["B2"])


@test("a guest checking out on the first day does not clash")
def _():
    bookings = [{"room": "A1", "start": 1, "end": 3}]
    expect(free_rooms(["A1"], bookings, 3, 5)).to_equal(["A1"])


@test("a guest arriving on the checkout day does not clash")
def _():
    bookings = [{"room": "A1", "start": 5, "end": 7}]
    expect(free_rooms(["A1"], bookings, 3, 5)).to_equal(["A1"])


@test("the result is sorted and the rooms list is left as it was")
def _():
    rooms = ["C3", "A1", "B2"]
    expect(free_rooms(rooms, [], 1, 2)).to_equal(["A1", "B2", "C3"])
    expect(rooms).to_equal(["C3", "A1", "B2"])


@test("a booking that covers the whole stay takes the room")
def _():
    bookings = [{"room": "B2", "start": 1, "end": 10}]
    expect(free_rooms(["A1", "B2"], bookings, 3, 5)).to_equal(["A1"])
