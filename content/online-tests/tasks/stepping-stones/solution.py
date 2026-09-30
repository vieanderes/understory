from collections import deque


def solution(A, K):
    # best[i] is A[i] plus the best of the K stones before it. A deque of indices with
    # falling best values keeps that maximum at the front: O(N).
    n = len(A)
    best = [0] * n
    best[0] = A[0]
    window = deque([0])
    for i in range(1, n):
        if window[0] < i - K:
            window.popleft()
        best[i] = A[i] + best[window[0]]
        while window and best[window[-1]] <= best[i]:
            window.pop()
        window.append(i)
    return best[n - 1]
