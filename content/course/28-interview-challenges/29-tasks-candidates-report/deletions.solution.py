# Walk once. Each A after some B either goes (one more deletion) or stays, and then every
# B so far must go. Keep the cheaper of the two, so the answer so far is always optimal.
def min_deletions(letters):
    bs_so_far = 0
    deletions = 0
    for letter in letters:
        if letter == "B":
            bs_so_far += 1
        else:
            deletions = min(deletions + 1, bs_so_far)
    return deletions
