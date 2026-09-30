def solution(N):
    # Each step reads the digits of the current value with % and //, so no string round trip.
    value = N
    steps = 0
    while value > 0:
        largest = 0
        rest = value
        while rest > 0:
            largest = max(largest, rest % 10)
            rest //= 10
        value -= largest
        steps += 1
    return steps
