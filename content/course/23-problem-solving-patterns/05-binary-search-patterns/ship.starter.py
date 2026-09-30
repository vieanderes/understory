def days_needed(weights, capacity):
    days = 1
    load = 0
    for weight in weights:
        if load + weight > capacity:
            days += 1
            load = 0
        load += weight
    return days


def min_ship_capacity(weights, days):
    # Target O(n log(total)): binary-search the capacity, from the heaviest parcel to the total.
    return 0
