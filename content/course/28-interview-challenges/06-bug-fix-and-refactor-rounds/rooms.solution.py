# Returns the rooms free for every night from start up to, not including, end,
# in alphabetical order. A booking is a dict: its "room", its "start" (the first night,
# as a day number) and its "end" (the checkout day, which is not a night).
def free_rooms(rooms, bookings, start, end):
    taken = set()
    for booking in bookings:
        overlaps = booking["start"] < end and booking["end"] > start
        if overlaps:
            taken.add(booking["room"])
    free = []
    for room in sorted(rooms):
        if room not in taken:
            free.append(room)
    return free
