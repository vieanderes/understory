from solution import decide

TOOLS = {
    "search_catalogue": {"effect": "read", "sends_out": False},
    "fetch_page": {"effect": "read", "sends_out": True},
    "renew_loan": {"effect": "write", "sends_out": False},
    "email_patron": {"effect": "write", "sends_out": True},
    "delete_account": {"effect": "irreversible", "sends_out": False},
}


def run(sensitivity="public", untrusted=False):
    return {"sensitivity": sensitivity, "untrusted": untrusted}


def call(name):
    return {"name": name, "input": {}}


@test("a read that sends nothing out is allowed, whatever is in context")
def _():
    got = decide(call("search_catalogue"), TOOLS, run("secret", untrusted=True))
    assert got["decision"] == "allow"


@test("private data plus untrusted content plus a way out is denied")
def _():
    got = decide(call("email_patron"), TOOLS, run("personal", untrusted=True))
    assert got["decision"] == "deny"
    expect(got["reason"]).to_contain("trifecta")


@test("two legs of the trifecta ask a person instead")
def _():
    assert decide(call("email_patron"), TOOLS, run("personal"))["decision"] == "ask"
    assert decide(call("fetch_page"), TOOLS, run("public", untrusted=True))["decision"] == "ask"
    assert decide(call("fetch_page"), TOOLS, run("public"))["decision"] == "allow"


@test("secret data never leaves, even with clean context")
def _():
    got = decide(call("fetch_page"), TOOLS, run("secret"))
    assert got["decision"] == "deny"


@test("an irreversible action always asks, even in a clean run")
def _():
    assert decide(call("delete_account"), TOOLS, run())["decision"] == "ask"


@test("a write asks once untrusted content is in context")
def _():
    assert decide(call("renew_loan"), TOOLS, run())["decision"] == "allow"
    got = decide(call("renew_loan"), TOOLS, run(untrusted=True))
    assert got["decision"] == "ask"
    expect(got["reason"]).to_contain("untrusted")


@test("a tool the policy doesn't know is denied")
def _():
    got = decide(call("export_all_patrons"), TOOLS, run())
    assert got == {"decision": "deny", "reason": "unknown tool"}
