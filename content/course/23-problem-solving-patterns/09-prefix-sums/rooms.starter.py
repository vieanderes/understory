def rooms_per_night(nights, bookings):
    # Target O(n + b): mark where each booking changes the count, then keep a running total.
    return [0] * nights
