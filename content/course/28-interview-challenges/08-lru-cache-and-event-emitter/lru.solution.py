from collections import OrderedDict


# An OrderedDict keeps its keys in order, so the first key is always the least recently
# used, as long as every read and every write moves its key to the end.
class LRUCache:
    def __init__(self, capacity: int):
        self._capacity = capacity
        self._entries: OrderedDict = OrderedDict()

    def __len__(self) -> int:
        return len(self._entries)

    def get(self, key):
        if key not in self._entries:
            return None
        self._entries.move_to_end(key)
        return self._entries[key]

    def put(self, key, value) -> None:
        self._entries[key] = value
        self._entries.move_to_end(key)
        if len(self._entries) > self._capacity:
            self._entries.popitem(last=False)
