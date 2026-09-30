def announce_batches(items, size):
    batches = items // size
    if items % size > 0:
        batches = batches + 1
    for n in range(1, batches + 1):
        print(f"Batch {n} of {batches}")
