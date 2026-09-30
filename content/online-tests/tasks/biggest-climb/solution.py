def solution(A):
    # The best climb ending at reading i starts at the lowest reading before it, so one pass
    # that remembers the lowest point so far is enough: O(N).
    lowest = None
    best = 0
    for altitude in A:
        if lowest is None or altitude < lowest:
            lowest = altitude
        elif altitude - lowest > best:
            best = altitude - lowest
    return best
