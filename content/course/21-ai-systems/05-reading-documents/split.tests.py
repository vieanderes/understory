from solution import split_batch


def page(label, p):
    rest = (1 - p) / 2
    others = [k for k in ("delivery_note", "returns_form", "continuation") if k != label]
    return {label: p, others[0]: rest, others[1]: rest}


@test("two sure one-page documents are extracted on their own")
def _():
    assert split_batch([page("delivery_note", 0.97), page("returns_form", 0.95)]) == [
        {"type": "delivery_note", "pages": [1], "route": "extract"},
        {"type": "returns_form", "pages": [2], "route": "extract"},
    ]


@test("a continuation page joins the document before it")
def _():
    pages = [page("delivery_note", 0.96), page("continuation", 0.93), page("delivery_note", 0.94)]
    assert split_batch(pages) == [
        {"type": "delivery_note", "pages": [1, 2], "route": "extract"},
        {"type": "delivery_note", "pages": [3], "route": "extract"},
    ]


@test("one unsure page sends its whole document to review")
def _():
    pages = [page("delivery_note", 0.96), page("continuation", 0.7)]
    assert split_batch(pages) == [
        {"type": "delivery_note", "pages": [1, 2], "route": "review"},
    ]


@test("a page below the review line becomes its own unknown document")
def _():
    scores = {"delivery_note": 0.45, "returns_form": 0.40, "continuation": 0.15}
    assert split_batch([page("returns_form", 0.92), scores]) == [
        {"type": "returns_form", "pages": [1], "route": "extract"},
        {"type": "unknown", "pages": [2], "route": "review"},
    ]


@test("a batch that starts with a continuation page is reviewed")
def _():
    assert split_batch([page("continuation", 0.95)]) == [
        {"type": "unknown", "pages": [1], "route": "review"},
    ]


@test("an empty batch gives no documents")
def _():
    assert split_batch([]) == []


@test("a review line above the auto line raises ValueError")
def _():
    expect(lambda: split_batch([], auto=0.5, review=0.8)).to_raise(ValueError)
