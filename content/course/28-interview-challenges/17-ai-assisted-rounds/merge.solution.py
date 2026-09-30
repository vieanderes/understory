def merge_bookings(bookings):
    merged = []
    for start, end in sorted(bookings, key=lambda booking: booking[0]):
        # Touching counts as joining (<=), and a booking inside a longer one must not
        # shorten the block, so keep the larger end.
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
