def rooms_per_night(nights, bookings):
    # One slot longer than nights, so a booking that ends on the last night
    # still has a place for its -1.
    diff = [0] * (nights + 1)
    for first, last in bookings:
        diff[first] += 1
        diff[last + 1] -= 1
    rooms = []
    running = 0
    for night in range(nights):
        running += diff[night]
        rooms.append(running)
    return rooms
