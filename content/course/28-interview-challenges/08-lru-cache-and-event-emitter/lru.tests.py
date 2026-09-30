from solution import LRUCache


@test("a missing key gives None")
def _():
    cache = LRUCache(2)
    assert cache.get("cart") is None


@test("over capacity, the least recently used key goes")
def _():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("c", 3)
    assert cache.get("a") is None
    assert cache.get("b") == 2
    assert len(cache) == 2


@test("a read makes a key recently used")
def _():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.get("a")
    cache.put("c", 3)
    assert cache.get("a") == 1
    assert cache.get("b") is None


@test("updating a key keeps one entry and refreshes it")
def _():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("a", 10)
    cache.put("c", 3)
    assert len(cache) == 2
    assert cache.get("a") == 10
    assert cache.get("b") is None


@test("a cache of one keeps only the latest key")
def _():
    cache = LRUCache(1)
    cache.put(1, "one")
    cache.put(2, "two")
    assert cache.get(1) is None
    assert cache.get(2) == "two"


@test("large: 200,000 reads on a cache of 50,000 stay fast")
def _():
    cache = LRUCache(50_000)
    for i in range(50_000):
        cache.put(i, i)
    total = 0
    for i in range(200_000):
        total += cache.get((i * 7919) % 50_000) or 0
    for i in range(50_000, 51_000):
        cache.put(i, i)
    assert total == 4_999_900_000
    assert len(cache) == 50_000
    assert cache.get(0) is None
    assert cache.get(50_999) == 50_999
