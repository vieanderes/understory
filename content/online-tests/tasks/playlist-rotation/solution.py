def solution(A, K):
    # Only K mod N moves matter; Python's % already maps a negative K into [0, N).
    n = len(A)
    if n == 0:
        return []
    shift = K % n
    return A[n - shift:] + A[:n - shift]
