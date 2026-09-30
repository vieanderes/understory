def solution(A, K):
    # Sort, then two pointers from both ends: O(N * log(N)).
    prices = sorted(A)
    left, right = 0, len(prices) - 1
    count = 0
    while left < right:
        if prices[left] + prices[right] <= K:
            count += right - left
            left += 1
        else:
            right -= 1
    return count
