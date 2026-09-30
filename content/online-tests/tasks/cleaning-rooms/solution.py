import heapq


def solution(S, E, C):
    # The heap holds the minute each room in use is free again. Take bookings in order
    # of start and reuse the room that frees up first when it is free: O(N * log(N)).
    free_at = []
    for start, end in sorted(zip(S, E)):
        if free_at and free_at[0] <= start:
            heapq.heapreplace(free_at, end + C)
        else:
            heapq.heappush(free_at, end + C)
    return len(free_at)
