from types import SimpleNamespace as Obj

from solution import ask


def text(value):
    return Obj(type="text", text=value)


class FakeClient:
    """Stands in for anthropic.Anthropic(): records each request, returns a recorded reply."""

    def __init__(self, *blocks):
        self.requests = []
        self.messages = Obj(create=self.create)
        self.reply = Obj(content=list(blocks), stop_reason="end_turn")

    def create(self, **request):
        self.requests.append(request)
        return self.reply


@test("returns the text of a one-block reply")
def _():
    client = FakeClient(text("Paris."))
    assert ask(client, "Capital of France?") == "Paris."


@test("sends one user message with the question")
def _():
    client = FakeClient(text("Paris."))
    ask(client, "Capital of France?")
    assert len(client.requests) == 1
    sent = client.requests[0]
    assert sent["messages"] == [{"role": "user", "content": "Capital of France?"}]


@test("names the model and caps the reply with max_tokens")
def _():
    client = FakeClient(text("Paris."))
    ask(client, "Capital of France?")
    sent = client.requests[0]
    assert sent["model"] == "claude-opus-5-5"
    assert sent["max_tokens"] > 0


@test("joins every text block, in order")
def _():
    client = FakeClient(text("Paris, "), text("on the Seine."))
    assert ask(client, "Capital of France?") == "Paris, on the Seine."


@test("skips blocks that are not text")
def _():
    client = FakeClient(Obj(type="thinking", thinking=""), text("Paris."))
    assert ask(client, "Capital of France?") == "Paris."
