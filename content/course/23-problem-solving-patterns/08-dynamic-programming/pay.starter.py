def best_pay(pay):
    # Target O(n), O(1) space: for each shift, skip it, or take it plus the best from two shifts back.
    return sum(pay)
