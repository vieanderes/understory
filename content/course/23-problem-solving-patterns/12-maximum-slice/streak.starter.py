def best_streak(changes):
    # Target O(n): carry the best run ending today, and the best seen so far.
    best = 0
    for change in changes:
        best = max(best, change)
    return best
