# With n numbers, the answer is at most n + 1, so only 1 to n + 1 can matter. A counting
# list of that size ticks them off in one pass; the first unticked slot is the answer.
def first_free_number(used):
    limit = len(used) + 1
    seen = [False] * (limit + 1)
    for value in used:
        if 1 <= value <= limit:
            seen[value] = True
    number = 1
    while seen[number]:
        number += 1
    return number
