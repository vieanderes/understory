# Every split point gives front = prefix sum and back = total - front. One pass keeps the
# running prefix, so each split costs O(1) and the whole task is O(n).
def min_split_gap(entries):
    total = sum(entries)
    front = 0
    best = None
    # The back must keep at least one entry, so the last entry never joins the front.
    for amount in entries[:-1]:
        front += amount
        gap = abs(front - (total - front))
        if best is None or gap < best:
            best = gap
    return best
