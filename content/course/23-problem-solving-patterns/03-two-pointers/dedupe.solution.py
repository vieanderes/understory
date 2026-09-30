# write marks the end of the unique front. A value unlike the last kept one is copied
# there, so the list is changed in place and no second list is built.
def remove_duplicates(ids):
    if not ids:
        return 0
    write = 1
    for read in range(1, len(ids)):
        if ids[read] != ids[write - 1]:
            ids[write] = ids[read]
            write += 1
    return write
