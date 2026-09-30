from collections import deque


def solution(K, A):
    N = len(A)
    # best[i] = A[i] + max(best[i - K..i - 1]). A deque of indices with falling best values
    # keeps that window maximum at its front, so the DP is O(N) instead of O(N * K).
    best = [0] * N
    best[0] = A[0]
    window = deque([0])
    for i in range(1, N):
        if window[0] < i - K:
            window.popleft()
        best[i] = best[window[0]] + A[i]
        while window and best[window[-1]] <= best[i]:
            window.pop()
        window.append(i)
    return best[N - 1]
