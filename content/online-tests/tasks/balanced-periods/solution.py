def solution(A, K):
    # Count earlier running totals equal to the current one minus K: O(N).
    limit = 1_000_000_000
    seen = {0: 1}
    prefix = 0
    count = 0
    for change in A:
        prefix += change
        count += seen.get(prefix - K, 0)
        if count > limit:
            return -1
        seen[prefix] = seen.get(prefix, 0) + 1
    return count
