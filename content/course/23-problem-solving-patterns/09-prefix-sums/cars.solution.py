# Each west car passes every east car before it, so a running count of east cars replaces
# the inner loop. The cap is "more than", so exactly 1,000,000,000 is still returned.
def passing_cars(cars):
    east = 0
    pairs = 0
    for car in cars:
        if car == 0:
            east += 1
        else:
            pairs += east
            if pairs > 1_000_000_000:
                return -1
    return pairs
