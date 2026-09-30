def first_bad(n, is_bad):
    lo, hi = 1, n  # build n is bad, so the answer is in range
    while lo < hi:
        mid = (lo + hi) // 2
        if is_bad(mid):
            hi = mid  # mid might be the first bad build
        else:
            lo = mid + 1  # the first bad build is after mid
    return lo
