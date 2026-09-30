def solution(K, A):
    # Caterpillar: for each right end, the left end only ever moves right, so O(N) in total.
    seen = [0] * 100001
    distinct = 0
    left = 0
    total = 0
    for right, label in enumerate(A):
        if seen[label] == 0:
            distinct += 1
        seen[label] += 1
        while distinct > K:
            seen[A[left]] -= 1
            if seen[A[left]] == 0:
                distinct -= 1
            left += 1
        # Every stretch ending at `right` and starting in [left..right] is tidy.
        total += right - left + 1
    return total
