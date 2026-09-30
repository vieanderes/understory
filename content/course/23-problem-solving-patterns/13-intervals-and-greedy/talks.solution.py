def most_talks(talks):
    # The talk that ends first leaves the most time for the rest.
    count = 0
    free = float("-inf")
    for start, end in sorted(talks, key=lambda talk: talk[1]):
        if start >= free:
            count += 1
            free = end
    return count
