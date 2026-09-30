def rooms_needed(S: list[int], E: list[int], C: int) -> int:
    # Correct, but slow: O(N^2). The most rooms are busy at the start of some booking,
    # so count, for each start, the bookings (with cleaning) that cover it.
    most = 0
    for start in S:
        busy = 0
        for j in range(len(S)):
            if S[j] <= start < E[j] + C:
                busy += 1
        most = max(most, busy)
    return most
