def solution(K, A):
    # Greedy check: fill each batch until the next episode would exceed the cap.
    def batches_needed(cap):
        batches = 1
        current = 0
        for minutes in A:
            if current + minutes > cap:
                batches += 1
                current = minutes
            else:
                current += minutes
        return batches

    # A bigger cap never needs more batches, so the smallest cap that fits is binary-searchable.
    lo = max(A)
    hi = sum(A)
    while lo < hi:
        mid = (lo + hi) // 2
        if batches_needed(mid) <= K:
            hi = mid
        else:
            lo = mid + 1
    return lo
