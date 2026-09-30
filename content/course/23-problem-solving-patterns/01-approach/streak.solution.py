# One pass: the current run grows on a good day and resets on a missed one. Updating
# best on every day, not only on a reset, counts a run that reaches the last day.
def longest_streak(steps, goal):
    best = 0
    current = 0
    for count in steps:
        current = current + 1 if count >= goal else 0
        best = max(best, current)
    return best
