import numpy as np

from solution import top_k

PASSAGES = np.array([
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [9.0, 1.0, 0.0],
    [0.0, 0.0, 1.0],
])


@test("returns the rows most like the query, closest first")
def _():
    assert top_k(np.array([1.0, 0.1, 0.0]), PASSAGES, 2) == [2, 0]


@test("compares directions, not lengths")
def _():
    # Row 2 is long, but row 1 points the same way as the query.
    assert top_k(np.array([0.0, 5.0, 0.0]), PASSAGES, 1) == [1]


@test("k larger than the table returns every row")
def _():
    expect(top_k(np.array([0.0, 0.0, 1.0]), PASSAGES, 10)).to_have_length(4)


@test("returns plain ints, ready to index a list of texts")
def _():
    first = top_k(np.array([1.0, 0.0, 0.0]), PASSAGES, 1)[0]
    expect(first).to_be_instance_of(int)


@test("ranks a thousand embeddings in one go")
def _():
    rng = np.random.default_rng(7)
    table = rng.normal(size=(1000, 64))
    query = table[123] * 3
    assert top_k(query, table, 1) == [123]
