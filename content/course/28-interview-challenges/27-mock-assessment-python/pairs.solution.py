def count_bundles(A: list[int], K: int) -> int:
    prices = sorted(A)
    left, right = 0, len(prices) - 1
    count = 0
    while left < right:
        if prices[left] + prices[right] <= K:
            # prices[left] fits with every price from left + 1 to right, as they are no larger.
            count += right - left
            left += 1
        else:
            right -= 1
    return count
