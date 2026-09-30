from solution import top_ids

PASSAGES = [
    {"id": "a", "score": 0.4},
    {"id": "b", "score": 0.9},
    {"id": "c", "score": 0.7},
]


@test("returns the ids of the best k, best first")
def _():
    expect(top_ids(PASSAGES, 2)).to_equal(["b", "c"])


@test("a k larger than the list returns every id")
def _():
    expect(top_ids(PASSAGES, 10)).to_equal(["b", "c", "a"])


@test("equal scores keep their original order")
def _():
    tied = [{"id": "x", "score": 0.5}, {"id": "y", "score": 0.8}, {"id": "z", "score": 0.5}]
    expect(top_ids(tied, 3)).to_equal(["y", "x", "z"])


@test("leaves the passages in their original order")
def _():
    passages = list(PASSAGES)
    top_ids(passages, 1)
    expect(passages).to_equal(PASSAGES)
