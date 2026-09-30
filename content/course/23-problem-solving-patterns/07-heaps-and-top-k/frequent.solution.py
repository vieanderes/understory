from collections import Counter


class MinHeap:
    """A binary min-heap over a list. less(a, b) is true when a belongs nearer the root.
    The children of index i sit at 2i + 1 and 2i + 2."""

    def __init__(self, less):
        self._items = []
        self._less = less

    def size(self):
        return len(self._items)

    def peek(self):
        return self._items[0] if self._items else None

    def push(self, item):
        a = self._items
        a.append(item)
        i = len(a) - 1
        while i > 0:
            parent = (i - 1) // 2
            if not self._less(a[i], a[parent]):
                break
            a[i], a[parent] = a[parent], a[i]
            i = parent

    def pop(self):
        a = self._items
        if not a:
            return None
        top = a[0]
        last = a.pop()
        if not a:
            return top
        a[0] = last
        i = 0
        while True:
            left = 2 * i + 1
            right = left + 1
            nearest = i
            if left < len(a) and self._less(a[left], a[nearest]):
                nearest = left
            if right < len(a) and self._less(a[right], a[nearest]):
                nearest = right
            if nearest == i:
                return top
            a[i], a[nearest] = a[nearest], a[i]
            i = nearest


def top_k_frequent(words, k):
    if k <= 0:
        return []
    # The weakest entry sits at the root: fewer uses, or the same uses and later in the
    # alphabet. A stronger word pushes it out in O(log k).
    heap = MinHeap(lambda a, b: a[1] < b[1] or (a[1] == b[1] and a[0] > b[0]))
    for word, count in Counter(words).items():
        heap.push((word, count))
        if heap.size() > k:
            heap.pop()
    result = []
    while heap.size() > 0:
        result.append(heap.pop()[0])
    result.reverse()
    return result
