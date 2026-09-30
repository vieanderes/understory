def dominant(codes):
    # Pair off different codes: a code in more than half of them survives.
    candidate, count = None, 0
    for code in codes:
        if count == 0:
            candidate = code
        count += 1 if code == candidate else -1
    # Something survives even with no majority, so check it.
    seen = 0
    for code in codes:
        if code == candidate:
            seen += 1
    return candidate if seen * 2 > len(codes) else -1
