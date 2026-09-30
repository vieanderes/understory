def solution(S, P, Q):
    # One running count per genre: seen[g][i] is how many of the first i books have genre g,
    # so any segment's count of g is a difference of two entries. O(N + M).
    seen = []
    for genre in 'FHPS':
        counts = [0] * (len(S) + 1)
        running = 0
        for i, book in enumerate(S):
            if book == genre:
                running += 1
            counts[i + 1] = running
        seen.append(counts)
    out = []
    for p, q in zip(P, Q):
        lo, hi = (p, q) if p <= q else (q, p)
        out.append(sum(1 for counts in seen if counts[hi + 1] > counts[lo]))
    return out
