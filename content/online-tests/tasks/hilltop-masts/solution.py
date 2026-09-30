def solution(A):
    n = len(A)
    # nxt[i] is the first hilltop at or after i, so a greedy placement jumps from one mast
    # to the next in O(1) instead of scanning the gap.
    nxt = [-1] * (n + 1)
    for i in range(n - 2, 0, -1):
        nxt[i] = i if A[i - 1] < A[i] > A[i + 1] else nxt[i + 1]
    if n >= 2:
        nxt[0] = nxt[1]
    # K masts span at least (K - 1) * K positions, so K never passes about sqrt(N), and each K
    # places at most K masts: O(N) in all.
    best = 0
    k = 1
    while (k - 1) * k <= n:
        placed = 0
        at = nxt[0]
        while at != -1 and placed < k:
            placed += 1
            at = nxt[at + k] if at + k < n else -1
        best = max(best, placed)
        k += 1
    return best
