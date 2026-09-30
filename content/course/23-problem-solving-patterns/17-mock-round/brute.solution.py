def longest_run(nums):
    if not nums:
        return 0
    # set() drops repeats, which would otherwise break a run.
    values = sorted(set(nums))
    best = run = 1
    for previous, current in zip(values, values[1:]):
        run = run + 1 if current == previous + 1 else 1
        best = max(best, run)
    return best
