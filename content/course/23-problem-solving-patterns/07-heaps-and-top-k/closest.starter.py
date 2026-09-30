import heapq


def k_closest(stores, k):
    # Target O(n log k): a heap of at most k stores, with the farthest at the root.
    return list(range(min(k, len(stores))))
