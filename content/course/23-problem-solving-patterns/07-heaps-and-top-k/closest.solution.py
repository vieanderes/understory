import heapq


def k_closest(stores, k):
    heap = []
    for index, (x, y) in enumerate(stores):
        # Squared distance keeps the order and avoids a square root.
        distance = x * x + y * y
        # heapq is a min-heap: negating puts the farthest, highest index at the root.
        heapq.heappush(heap, (-distance, -index))
        if len(heap) > k:
            heapq.heappop(heap)
    return [-i for _, i in sorted(heap, key=lambda entry: (-entry[0], -entry[1]))]
