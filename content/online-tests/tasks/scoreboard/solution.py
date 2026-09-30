def solution(N, A):
    # A catch-up is recorded as a floor, not applied to all N scores: O(N + M).
    scores = [0] * N
    floor = 0
    best = 0
    for operation in A:
        if operation == N + 1:
            floor = best
            continue
        i = operation - 1
        scores[i] = max(scores[i], floor) + 1
        if scores[i] > best:
            best = scores[i]
    return [max(score, floor) for score in scores]
