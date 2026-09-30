def solution(N, R):
    # Smallest-factor sieve: x is a two-prime product when x // spf(x) is a different prime.
    spf = [0] * (N + 1)
    i = 2
    while i * i <= N:
        if spf[i] == 0:
            for j in range(i * i, N + 1, i):
                if spf[j] == 0:
                    spf[j] = i
        i += 1
    # Prefix counts answer every query in O(1).
    count = [0] * (N + 1)
    for x in range(2, N + 1):
        hit = 0
        p = spf[x]
        if p != 0:
            q = x // p
            if spf[q] == 0 and q != p:
                hit = 1
        count[x] = count[x - 1] + hit
    return [count[b] - count[a - 1] for a, b in R]
