def leaders(values):
    # If a prefix has a leader, the running Boyer-Moore candidate is that leader, so one
    # pass with a count per value tells, for every prefix, whether it has one and which.
    out = []
    counts = {}
    candidate = None
    votes = 0
    for i, x in enumerate(values):
        counts[x] = counts.get(x, 0) + 1
        if votes == 0:
            candidate = x
            votes = 1
        elif x == candidate:
            votes += 1
        else:
            votes -= 1
        out.append((True, candidate) if counts[candidate] * 2 > i + 1 else (False, None))
    return out


def solution(A):
    # Leaders of every prefix, and of every suffix by running the same pass backwards: O(N).
    n = len(A)
    left = leaders(A)
    right = leaders(A[::-1])
    splits = 0
    for s in range(n - 1):
        has_l, lead_l = left[s]
        has_r, lead_r = right[n - 2 - s]
        if has_l and has_r and lead_l != lead_r:
            splits += 1
    return splits
