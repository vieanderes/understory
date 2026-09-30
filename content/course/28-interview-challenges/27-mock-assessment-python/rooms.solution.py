import heapq


def rooms_needed(S: list[int], E: list[int], C: int) -> int:
    # The heap holds, for each room in use, the minute it is free again.
    # Its smallest entry is the room that frees up first.
    free_at: list[int] = []
    for start, end in sorted(zip(S, E)):
        if free_at and free_at[0] <= start:
            heapq.heapreplace(free_at, end + C)
        else:
            heapq.heappush(free_at, end + C)
    return len(free_at)
