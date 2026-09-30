def solution(A):
    best = 0
    current = 0
    for day in A:
        if day == 1:
            current += 1
        else:
            best = max(best, current)
            current = 0
    return best
