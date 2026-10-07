from solution import rank_queue

SLA = {1: 48, 2: 24, 3: 8, 4: 2, 5: 1}  # hours a reviewer may take, by risk


def item(id, risk, confidence, created):
    return {"id": id, "risk": risk, "confidence": confidence, "created": created}


@test("an unsure, risky item comes before a confident, harmless one")
def _():
    items = [item("cake-12", 1, 0.95, 100), item("cake-13", 4, 0.40, 100)]
    assert rank_queue(items, 100.5, SLA) == ["cake-13", "cake-12"]


@test("a confident risky item can rank below an unsure medium one")
def _():
    items = [item("refit", 5, 0.9, 100), item("swap", 2, 0.2, 100)]
    assert rank_queue(items, 100.5, SLA) == ["swap", "refit"]


@test("an item past its SLA jumps the queue, most overdue first")
def _():
    items = [
        item("fresh-risky", 5, 0.1, 99.8),
        item("late-small", 1, 0.9, 30),
        item("later-small", 2, 0.9, 60),
    ]
    assert rank_queue(items, 100, SLA) == ["late-small", "later-small", "fresh-risky"]


@test("reaching the SLA exactly counts as overdue")
def _():
    items = [item("risky", 5, 0.0, 99.9), item("due", 3, 0.9, 92)]
    assert rank_queue(items, 100, SLA)[0] == "due"


@test("equal scores go oldest first, then by id")
def _():
    items = [item("b", 2, 0.5, 90), item("c", 2, 0.5, 95), item("a", 2, 0.5, 95)]
    assert rank_queue(items, 100, SLA) == ["b", "a", "c"]


@test("an empty queue gives an empty list, and an unknown risk raises")
def _():
    assert rank_queue([], 100, SLA) == []
    expect(lambda: rank_queue([item("x", 9, 0.5, 100)], 100, SLA)).to_raise(ValueError)
