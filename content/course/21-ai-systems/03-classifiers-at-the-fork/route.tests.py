from solution import route_ticket

BASE = {
    "category": {"refund": 0.94, "complaint": 0.03, "question": 0.02, "spam": 0.01},
    "urgency": 4,
    "needs_human": 0.12,
    "legal_threat": 0.02,
}


def ticket(**changes):
    return {**BASE, **changes}


@test("a confident refund goes to the refund workflow")
def _():
    assert route_ticket(ticket()) == "auto-refund"


@test("a legal threat escalates, whatever else it says")
def _():
    assert route_ticket(ticket(legal_threat=0.7)) == "escalate-legal"


@test("a refund at 0.75 isn't confident enough to act on alone")
def _():
    unsure = {"refund": 0.75, "complaint": 0.2, "question": 0.05}
    assert route_ticket(ticket(category=unsure, needs_human=0.6)) == "human-queue"


@test("no label at 0.6 or more goes to a person")
def _():
    split = {"refund": 0.41, "complaint": 0.38, "question": 0.21}
    assert route_ticket(ticket(category=split)) == "human-queue"


@test("near-certain spam is discarded")
def _():
    assert route_ticket(ticket(category={"spam": 0.97, "question": 0.03})) == "discard"


@test("a question gets a drafted reply, flagged urgent at 4 or more")
def _():
    question = {"question": 0.88, "complaint": 0.12}
    assert route_ticket(ticket(category=question)) == "draft-reply-urgent"
    assert route_ticket(ticket(category=question, urgency=2)) == "draft-reply"


@test("an empty category raises ValueError")
def _():
    expect(lambda: route_ticket(ticket(category={}))).to_raise(ValueError)
