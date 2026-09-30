# Put every number in a set. Only a number with no left neighbour starts a run, so each
# run is counted once from its start, and every number is looked at about twice: O(n).
def longest_run(nums):
    seen = set(nums)
    best = 0
    for n in seen:
        if n - 1 in seen:
            continue
        length = 1
        while n + length in seen:
            length += 1
        best = max(best, length)
    return best
