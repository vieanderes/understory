# Each window differs from the one before by one value in and one value out, so a slide
# costs O(1) and the whole pass O(n), whatever k is.
def max_sum_of_k(values, k):
    if k <= 0 or k > len(values):
        return None
    total = sum(values[:k])
    best = total
    for i in range(k, len(values)):
        total += values[i] - values[i - k]
        best = max(best, total)
    return best
