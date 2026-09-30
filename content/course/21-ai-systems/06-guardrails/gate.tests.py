from solution import gate_action

POLICY = {
    "allowed": ["search_orders", "draft_email", "send_bulk_email"],
    "irreversible": ["send_bulk_email"],
}
SAFE = {"tool": "search_orders", "risk": 1, "matches_intent": 0.97, "pii_leak": 0.01}


def proposal(**changes):
    return {**SAFE, **changes}


@test("a low-risk action that matches the request runs")
def _():
    assert gate_action(proposal(), POLICY) == "run"


@test("a tool outside the allow-list is blocked")
def _():
    assert gate_action(proposal(tool="delete_account"), POLICY) == "block"


@test("a likely personal data leak is blocked, even for an allowed tool")
def _():
    assert gate_action(proposal(pii_leak=0.8), POLICY) == "block"


@test("an irreversible tool always waits for a person")
def _():
    assert gate_action(proposal(tool="send_bulk_email"), POLICY) == "approve"


@test("high risk or doubtful intent waits for a person")
def _():
    assert gate_action(proposal(risk=4), POLICY) == "approve"
    assert gate_action(proposal(matches_intent=0.71), POLICY) == "approve"


@test("blocking beats approval")
def _():
    assert gate_action(proposal(tool="send_bulk_email", pii_leak=0.9), POLICY) == "block"


@test("a risk outside 1 to 5 raises ValueError")
def _():
    expect(lambda: gate_action(proposal(risk=9), POLICY)).to_raise(ValueError)
