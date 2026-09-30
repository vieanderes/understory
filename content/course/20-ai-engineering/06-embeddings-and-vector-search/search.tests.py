from solution import top_k

# Made-up three-number vectors. Real embeddings have hundreds or thousands of numbers.
PASSAGES = [
    {"text": "Opening hours are 9 to 5.", "vector": [0.1, 0.9, 0.0]},
    {"text": "Refunds take five working days.", "vector": [0.9, 0.1, 0.2]},
    {"text": "Return an item within 30 days.", "vector": [0.7, 0.2, 0.5]},
    {"text": "We deliver on Saturdays.", "vector": [0.0, 0.3, 0.9]},
]
MONEY_BACK = [0.95, 0.05, 0.25]


@test("returns the closest passage first")
def _():
    assert top_k(MONEY_BACK, PASSAGES, 1) == ["Refunds take five working days."]


@test("returns k passages, closest first")
def _():
    assert top_k(MONEY_BACK, PASSAGES, 2) == [
        "Refunds take five working days.",
        "Return an item within 30 days.",
    ]


@test("asking for more than there are returns them all")
def _():
    assert len(top_k(MONEY_BACK, PASSAGES, 10)) == 4


@test("no passages gives an empty list")
def _():
    assert top_k(MONEY_BACK, [], 3) == []


@test("equal scores keep the stored order")
def _():
    twins = [{"text": "first", "vector": [1, 0]}, {"text": "second", "vector": [2, 0]}]
    assert top_k([1, 0], twins, 2) == ["first", "second"]


@test("does not reorder the stored passages")
def _():
    stored = list(PASSAGES)
    top_k(MONEY_BACK, stored, 2)
    assert stored == PASSAGES
