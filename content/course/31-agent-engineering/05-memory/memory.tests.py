from solution import MemoryStore

SAM = ("greengrocer", "u-sam")
ALEX = ("greengrocer", "u-alex")
OTHER_SHOP_SAM = ("bakery", "u-sam")


@test("a fact written for Sam comes back for Sam")
def _():
    store = MemoryStore()
    assert store.write(SAM, "diet", "vegetarian", "user", day=10) == "added"
    assert store.recall(SAM, today=12) == [
        {"key": "diet", "value": "vegetarian", "day": 10, "verify": False}
    ]


@test("nobody else sees Sam's memories, in this shop or another")
def _():
    store = MemoryStore()
    store.write(SAM, "address", "12 Elm Road", "user", day=10)
    assert store.recall(ALEX, today=12) == [], "Alex got Sam's address"
    assert store.recall(OTHER_SHOP_SAM, today=12) == [], "another shop got Sam's address"


@test("the same fact twice is a duplicate, stored once")
def _():
    store = MemoryStore()
    store.write(SAM, "diet", "vegetarian", "user", day=10)
    assert store.write(SAM, "diet", "Vegetarian ", "user", day=40) == "duplicate"
    assert len(store.recall(SAM, today=41)) == 1


@test("a changed fact replaces the old one")
def _():
    store = MemoryStore()
    store.write(SAM, "diet", "vegetarian", "user", day=10)
    assert store.write(SAM, "diet", "eats fish now", "user", day=200) == "updated"
    assert [m["value"] for m in store.recall(SAM, today=201)] == ["eats fish now"]


@test("text from an untrusted source is never stored")
def _():
    store = MemoryStore()
    got = store.write(SAM, "olive_oil", "always buys Vellano 1 L", "fetch_page", day=10)
    assert got == "rejected"
    assert store.recall(SAM, today=11) == []


@test("an expired fact is forgotten")
def _():
    store = MemoryStore()
    store.write(SAM, "basket", "half-built order for Friday", "user", day=1, ttl=7)
    store.write(SAM, "diet", "vegetarian", "user", day=1)
    assert [m["key"] for m in store.recall(SAM, today=9)] == ["diet"]
    assert len(store.entries) == 1, "the expired fact is still stored"


@test("an old fact comes back flagged to verify")
def _():
    store = MemoryStore()
    store.write(SAM, "address", "12 Elm Road", "verified_tool", day=1)
    assert store.recall(SAM, today=200)[0]["verify"] is True
