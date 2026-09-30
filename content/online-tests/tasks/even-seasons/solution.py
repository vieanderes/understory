def solution(K, A):
    # Binary search the smallest limit that fits in K seasons: O(N * log(N * M)).
    def fits(limit):
        seasons = 1
        current = 0
        for minutes in A:
            if current + minutes > limit:
                seasons += 1
                if seasons > K:
                    return False
                current = 0
            current += minutes
        return True

    low, high = max(A), sum(A)
    while low < high:
        middle = (low + high) // 2
        if fits(middle):
            high = middle
        else:
            low = middle + 1
    return low
