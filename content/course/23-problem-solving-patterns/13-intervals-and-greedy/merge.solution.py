# Sorted by start, only the last block can overlap the next booking. Touching bookings
# (end == next start) merge because the room is never free between them.
def merge_bookings(bookings):
    merged = []
    for start, end in sorted(bookings, key=lambda booking: booking[0]):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
