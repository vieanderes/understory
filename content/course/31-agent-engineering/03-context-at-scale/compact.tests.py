from solution import compact


def words(message):
    # Stands in for a real token counter.
    return len(message["text"].split())


TASK = {"role": "user", "text": "Plan five vegetarian dinners under £40, no peanuts", "pin": True}
ASK = {"role": "assistant", "text": "I'll check the shop for tofu and lentils"}
STOCK = {"role": "tool", "text": "tofu 1.80 lentils 1.10 chickpeas 0.90"}
PLAN = {"role": "assistant", "text": "Lentil curry Monday, tofu stir fry Tuesday"}
SWAP = {"role": "user", "text": "Swap Tuesday for something with beans"}
TACOS = {"role": "assistant", "text": "Black bean tacos on Tuesday then"}
HISTORY = [TASK, ASK, STOCK, PLAN, SWAP, TACOS]


@test("a history that fits is kept whole")
def _():
    assert compact(HISTORY, 100, words) == (HISTORY, [])


@test("the newest turns stay and the oldest go")
def _():
    kept, dropped = compact(HISTORY, 27, words)
    assert kept == [TASK, PLAN, SWAP, TACOS]
    assert dropped == [ASK, STOCK]


@test("a pinned decision keeps its place, however old")
def _():
    decision = {"role": "assistant", "text": "Decided: no peanut butter anywhere", "pin": True}
    history = [TASK, ASK, decision, STOCK, PLAN, SWAP, TACOS]
    kept, dropped = compact(history, 32, words)
    assert kept == [TASK, decision, PLAN, SWAP, TACOS]
    assert dropped == [ASK, STOCK]


@test("the kept turns never start with a tool result")
def _():
    kept, dropped = compact(HISTORY, 33, words)
    assert kept == [TASK, PLAN, SWAP, TACOS], "STOCK lost the call that asked for it"
    assert dropped == [ASK, STOCK]


@test("an old short message can't jump a long one that didn't fit")
def _():
    short = {"role": "user", "text": "thanks"}
    long = {"role": "tool", "text": " ".join(["recipe"] * 20)}
    history = [TASK, short, ASK, long, SWAP]
    kept, dropped = compact(history, 16, words)
    assert kept == [TASK, SWAP]
    assert dropped == [short, ASK, long]


@test("pinned messages over the budget raise ValueError")
def _():
    expect(lambda: compact(HISTORY, 5, words)).to_raise(ValueError)
