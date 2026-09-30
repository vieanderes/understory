from solution import build_request

SYSTEM = "You are a cooking assistant. Answer in two sentences."


def turn(n):
    return [
        {"role": "user", "content": f"question {n}"},
        {"role": "assistant", "content": f"answer {n}"},
    ]


HISTORY = turn(1) + turn(2) + turn(3)


@test("a first question has only the question")
def _():
    request = build_request(SYSTEM, [], "How long do I boil an egg?", keep=6)
    assert request["messages"] == [{"role": "user", "content": "How long do I boil an egg?"}]


@test("the system prompt is sent every time, outside the messages")
def _():
    request = build_request(SYSTEM, HISTORY, "And a duck egg?", keep=2)
    assert request["system"] == SYSTEM
    assert all(m["content"] != SYSTEM for m in request["messages"])


@test("keeps the most recent messages, then the new question")
def _():
    request = build_request(SYSTEM, HISTORY, "question 4", keep=4)
    assert [m["content"] for m in request["messages"]] == [
        "question 2", "answer 2", "question 3", "answer 3", "question 4",
    ]


@test("never starts with an assistant message")
def _():
    request = build_request(SYSTEM, HISTORY, "question 4", keep=3)
    assert request["messages"][0]["role"] == "user"
    assert [m["content"] for m in request["messages"]] == ["question 3", "answer 3", "question 4"]


@test("keeps everything when the history is short")
def _():
    request = build_request(SYSTEM, turn(1), "question 2", keep=10)
    assert len(request["messages"]) == 3


@test("does not change the history it was given")
def _():
    history = turn(1) + turn(2)
    build_request(SYSTEM, history, "question 3", keep=2)
    assert len(history) == 4
