def solution(A):
    N = len(A)
    # Fewer than 30 Fibonacci numbers fit below 100,002, so each cell tries only those.
    fib = [1, 2]
    while fib[-1] <= N + 1:
        fib.append(fib[-1] + fib[-2])
    # hops[i + 1] is the fewest hops to reach position i; index 0 is the start at -1.
    hops = [-1] * (N + 2)
    hops[0] = 0
    for pos in range(N + 1):
        if pos < N and A[pos] != 1:
            continue
        best = -1
        for f in fib:
            frm = pos - f
            if frm < -1:
                break
            h = hops[frm + 1]
            if h >= 0 and (best < 0 or h + 1 < best):
                best = h + 1
        hops[pos + 1] = best
    return hops[N + 1]
