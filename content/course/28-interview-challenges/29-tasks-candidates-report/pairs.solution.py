# A set answers "is -x here?" in O(1), so one pass over the positives finds every pair.
def largest_k(values):
    seen = set(values)
    return max((x for x in seen if x > 0 and -x in seen), default=0)
