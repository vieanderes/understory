def days_needed(weights, capacity):
    days = 1
    load = 0
    for weight in weights:
        if load + weight > capacity:
            days += 1
            load = 0
        load += weight
    return days


# A capacity below the heaviest parcel can never work, and the total always does. Between
# them, more capacity never needs more days, so the first capacity that fits is found by
# halving the range.
def min_ship_capacity(weights, days):
    if not weights:
        return 0
    lo = max(weights)
    hi = sum(weights)
    while lo < hi:
        mid = (lo + hi) // 2
        if days_needed(weights, mid) <= days:
            hi = mid
        else:
            lo = mid + 1
    return lo
