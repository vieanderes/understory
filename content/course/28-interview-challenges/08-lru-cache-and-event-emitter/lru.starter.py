from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity: int):
        self._capacity = capacity
        self._entries: OrderedDict = OrderedDict()

    def __len__(self) -> int:
        return len(self._entries)

    def get(self, key):
        # A read should also mark the key as the most recently used.
        return self._entries.get(key)

    def put(self, key, value) -> None:
        # Store the value, then evict the least recently used key once over capacity.
        self._entries[key] = value
