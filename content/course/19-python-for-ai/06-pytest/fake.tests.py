import solution
from solution import FakeClient

YOUR_TESTS = [
    solution.test_confident_reply_is_automatic,
    solution.test_unsure_reply_goes_to_a_human,
]


def passes(test_fn, triage_version):
    """Runs one of your tests against a version of triage. True if it passes."""
    real = solution.triage
    solution.triage = triage_version
    try:
        test_fn()
        return True
    except AssertionError:
        return False
    finally:
        solution.triage = real


def over_the_line(client, ticket):
    reply = client.classify(ticket)
    if reply["confidence"] > 0.9:
        return "auto:" + reply["label"]
    return "human"


def always_auto(client, ticket):
    return "auto:" + client.classify(ticket)["label"]


def always_human(client, ticket):
    client.classify(ticket)
    return "human"


@test("the fake returns the recorded replies in order")
def _():
    fake = FakeClient([{"label": "spam"}, {"label": "refund"}])
    assert fake.classify("first") == {"label": "spam"}
    assert fake.classify("second") == {"label": "refund"}


@test("the fake records each ticket it was asked about")
def _():
    fake = FakeClient([{"label": "spam"}, {"label": "spam"}])
    fake.classify("first")
    fake.classify("second")
    assert fake.calls == ["first", "second"]


@test("the fake fails loudly when its replies run out")
def _():
    fake = FakeClient([{"label": "spam"}])
    fake.classify("first")
    expect(lambda: fake.classify("second")).to_raise(AssertionError)


@test("two fakes never share their calls")
def _():
    one = FakeClient([{"label": "spam"}])
    FakeClient([{"label": "spam"}]).classify("other")
    assert one.calls == []


@test("both of your tests pass on the real triage")
def _():
    for test_fn in YOUR_TESTS:
        assert passes(test_fn, solution.triage), test_fn.__name__ + " fails on correct code"


@test("your tests catch a triage that always goes automatic")
def _():
    assert not all(passes(t, always_auto) for t in YOUR_TESTS), "no test caught it"


@test("your tests catch a triage that always goes to a human")
def _():
    assert not all(passes(t, always_human) for t in YOUR_TESTS), "no test caught it"


@test("your tests catch > 0.9 written where >= 0.9 belongs")
def _():
    assert not all(passes(t, over_the_line) for t in YOUR_TESTS), "test exactly 0.9"
