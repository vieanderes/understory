def count_bundles(A: list[int], K: int) -> int:
    # Correct, but it tries every pair: O(N^2).
    count = 0
    for p in range(len(A)):
        for q in range(p + 1, len(A)):
            if A[p] + A[q] <= K:
                count += 1
    return count
