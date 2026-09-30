def distinct_magnitudes(A: list[int]) -> int:
    # A set keeps each magnitude once, and adding to it or looking in it is O(1) on average.
    return len({abs(value) for value in A})
