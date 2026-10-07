from solution import gate

MODES = {"search_catalogue": "allow", "renew_loan": "allow", "email_patron": "ask"}


def no_objection(call):
    return None


def cap_renewal(call):
    if call["name"] == "renew_loan" and call["input"]["weeks"] > 3:
        return ("rewrite", {**call["input"], "weeks": 3})
    return None


def block_long_renewals(call):
    if call["name"] == "renew_loan" and call["input"]["weeks"] > 3:
        return ("block", "Renewals are 3 weeks at most")
    return None


def block_card_numbers(call):
    if "card" in str(call["input"]).lower():
        return ("block", "Library card numbers stay out of emails")
    return None


@test("an allowed tool with no objections runs")
def _():
    call = {"name": "search_catalogue", "input": {"q": "tide tables"}}
    got = gate(call, MODES, [no_objection])
    assert got == {"decision": "run", "input": {"q": "tide tables"}, "reason": None}


@test("a tool in ask mode waits for a person")
def _():
    call = {"name": "email_patron", "input": {"to": "p-12", "text": "Your hold is ready"}}
    assert gate(call, MODES, [no_objection])["decision"] == "ask"


@test("a tool outside the action space is blocked before any hook runs")
def _():
    seen = []
    got = gate({"name": "cancel_loan", "input": {}}, MODES, [lambda c: seen.append(c)])
    assert got["decision"] == "block"
    expect(got["reason"]).to_contain("not in the action space")
    assert seen == [], "hooks ran for a tool that doesn't exist"


@test("a block from a later hook wins over earlier no-objections")
def _():
    call = {"name": "email_patron", "input": {"text": "Your card is 2291-0042"}}
    got = gate(call, MODES, [no_objection, no_objection, block_card_numbers])
    assert got["decision"] == "block"
    assert got["reason"] == "Library card numbers stay out of emails"


@test("a rewrite is what later hooks see, and what runs")
def _():
    call = {"name": "renew_loan", "input": {"loan": "L-9", "weeks": 8}}
    got = gate(call, MODES, [cap_renewal, block_long_renewals])
    assert got["decision"] == "run", "the blocker saw the old 8 weeks, not the rewrite"
    assert got["input"] == {"loan": "L-9", "weeks": 3}


@test("the model's original call is left as it was, for the audit log")
def _():
    call = {"name": "renew_loan", "input": {"loan": "L-9", "weeks": 8}}
    gate(call, MODES, [cap_renewal])
    assert call == {"name": "renew_loan", "input": {"loan": "L-9", "weeks": 8}}
