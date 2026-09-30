# The assistant's version. It passes the example in the task. Fix it for the hidden tests.
def merge_bookings(bookings):
    merged = []
    for start, end in sorted(bookings, key=lambda booking: booking[0]):
        if merged and start < merged[-1][1]:
            merged[-1][1] = end
        else:
            merged.append([start, end])
    return merged
