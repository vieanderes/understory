# best(i) = the most you can earn from the first i shifts. Either skip shift i, or take
# it and skip the one before: max(best(i - 1), best(i - 2) + pay[i]). Filled bottom up,
# only the last two answers are ever needed.
def best_pay(pay):
    two_back = 0
    one_back = 0
    for amount in pay:
        two_back, one_back = one_back, max(one_back, two_back + amount)
    return one_back
