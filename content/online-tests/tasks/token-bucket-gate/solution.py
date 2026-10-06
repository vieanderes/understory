def solution(C, R, T):
    # Refill lazily: on each request, add R per second since the last one, capped at C.
    tokens = C
    last = T[0]
    verdicts = []
    for time in T:
        tokens = min(C, tokens + R * (time - last))
        last = time
        if tokens > 0:
            tokens -= 1
            verdicts.append(1)
        else:
            verdicts.append(0)
    return verdicts
