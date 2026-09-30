def solution(B):
    by_end = sorted(B, key=lambda booking: booking[1])
    accepted = 0
    last_end = -1
    for start, end in by_end:
        if start > last_end:
            accepted += 1
            last_end = end
    return accepted
