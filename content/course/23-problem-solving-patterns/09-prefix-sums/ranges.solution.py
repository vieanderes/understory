from itertools import accumulate


# prefix[i] holds the sum of the first i days, so prefix[0] is 0 and a range start..end
# (inclusive) is prefix[end + 1] - prefix[start]. One pass to build, O(1) per query.
def range_totals(steps, queries):
    prefix = [0, *accumulate(steps)]
    return [prefix[end + 1] - prefix[start] for start, end in queries]
