def grid_count(n):
    count = 0
    i = 1
    # i * i stays in whole numbers, so there's no rounding from a square root.
    while i * i <= n:
        if n % i == 0:
            # i and n // i are a pair, unless they're the same number.
            count += 1 if i * i == n else 2
        i += 1
    return count
