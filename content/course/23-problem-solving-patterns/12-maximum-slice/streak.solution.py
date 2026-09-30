# The best slice ending at each day either extends the best slice ending the day before
# or starts afresh. Both running values start at the first day, not 0, so a list of
# losses returns its smallest loss, not an empty slice.
def best_streak(changes):
    ending = best = changes[0]
    for change in changes[1:]:
        ending = max(change, ending + change)
        best = max(best, ending)
    return best
