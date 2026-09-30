import json
from types import SimpleNamespace as Obj

from solution import ask_json


class FakeClient:
    """Returns recorded replies in order, and keeps a copy of each request's messages."""

    def __init__(self, *texts):
        self.texts = list(texts)
        self.sent = []
        self.messages = Obj(create=self.create)

    def create(self, **request):
        self.sent.append([dict(m) for m in request["messages"]])
        text = self.texts[len(self.sent) - 1]
        return Obj(content=[Obj(type="text", text=text)], stop_reason="end_turn")


def validate(text):
    """Stands in for Order.model_validate_json: returns the data or raises ValueError."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise ValueError("not JSON")
    if not isinstance(data.get("quantity"), int):
        raise ValueError("quantity should be a whole number")
    return data


GOOD = '{"item": "lamp", "quantity": 2}'
CHATTY = 'Sure! {"item": "lamp", "quantity": 2}'
WRONG_TYPE = '{"item": "lamp", "quantity": "two"}'


@test("a valid first reply comes back after one call")
def _():
    client = FakeClient(GOOD)
    assert ask_json(client, "Two lamps please", validate) == {"item": "lamp", "quantity": 2}
    assert len(client.sent) == 1


@test("the first call sends the prompt as one user message")
def _():
    client = FakeClient(GOOD)
    ask_json(client, "Two lamps please", validate)
    assert client.sent[0] == [{"role": "user", "content": "Two lamps please"}]


@test("an invalid reply is retried, and the second one returned")
def _():
    client = FakeClient(CHATTY, GOOD)
    assert ask_json(client, "Two lamps please", validate) == {"item": "lamp", "quantity": 2}
    assert len(client.sent) == 2


@test("the retry shows the model its reply and the error")
def _():
    client = FakeClient(WRONG_TYPE, GOOD)
    ask_json(client, "Two lamps please", validate)
    retry = client.sent[1]
    assert retry[0] == {"role": "user", "content": "Two lamps please"}
    assert retry[1] == {"role": "assistant", "content": WRONG_TYPE}
    assert retry[2]["role"] == "user"
    assert "quantity should be a whole number" in retry[2]["content"]


@test("gives up with ValueError after the last attempt")
def _():
    client = FakeClient(CHATTY, CHATTY, CHATTY)
    expect(lambda: ask_json(client, "Two lamps please", validate, attempts=3)).to_raise(ValueError)
    assert len(client.sent) == 3
