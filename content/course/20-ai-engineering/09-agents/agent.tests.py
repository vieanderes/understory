from solution import run_agent


def text(value, stop_reason="end_turn"):
    return {"stop_reason": stop_reason, "content": [{"type": "text", "text": value}]}


def tool_call(*calls):
    blocks = [{"type": "text", "text": "Let me check."}]
    for call_id, name, arguments in calls:
        blocks.append({"type": "tool_use", "id": call_id, "name": name, "input": arguments})
    return {"stop_reason": "tool_use", "content": blocks}


def scripted(*replies):
    """A fake model: returns the replies in order, and keeps a copy of what it was sent."""
    seen = []

    def call_model(messages):
        seen.append([dict(m) for m in messages])
        return replies[len(seen) - 1]

    return call_model, seen


def train_times(origin, destination):
    if origin == destination:
        raise ValueError("Origin and destination are the same")
    return f"{origin} to {destination}: 09:10, 11:40"


TOOLS = {"train_times": train_times}


def ask(question):
    return [{"role": "user", "content": question}]


@test("a plain answer comes back after one call")
def _():
    call_model, seen = scripted(text("Hello."))
    assert run_agent(call_model, TOOLS, ask("hi")) == "Hello."
    assert len(seen) == 1


@test("runs the tool, sends the result, and returns the final answer")
def _():
    call_model, seen = scripted(
        tool_call(("t1", "train_times", {"origin": "York", "destination": "Leeds"})),
        text("The next train is at 09:10."),
    )
    messages = ask("Next train York to Leeds?")
    assert run_agent(call_model, TOOLS, messages) == "The next train is at 09:10."
    assert messages[2] == {
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": "t1",
                     "content": "York to Leeds: 09:10, 11:40"}],
    }


@test("keeps the whole assistant reply, tool_use blocks included")
def _():
    call_model, seen = scripted(
        tool_call(("t1", "train_times", {"origin": "York", "destination": "Leeds"})),
        text("09:10."),
    )
    messages = ask("Next train?")
    run_agent(call_model, TOOLS, messages)
    assert messages[1]["role"] == "assistant"
    assert [b["type"] for b in messages[1]["content"]] == ["text", "tool_use"]


@test("two calls in one reply go back in one user message")
def _():
    call_model, seen = scripted(
        tool_call(("t1", "train_times", {"origin": "York", "destination": "Leeds"}),
                  ("t2", "train_times", {"origin": "Leeds", "destination": "Hull"})),
        text("Done."),
    )
    messages = ask("York to Hull via Leeds?")
    run_agent(call_model, TOOLS, messages)
    assert len(messages) == 4
    assert [r["tool_use_id"] for r in messages[2]["content"]] == ["t1", "t2"]


@test("a failing or unknown tool goes back as an error result")
def _():
    call_model, seen = scripted(
        tool_call(("t1", "train_times", {"origin": "York", "destination": "York"}),
                  ("t2", "book_ticket", {"train": "09:10"})),
        text("Sorry, I can't book tickets."),
    )
    messages = ask("Book me York to York")
    run_agent(call_model, TOOLS, messages)
    results = messages[2]["content"]
    assert all(r["is_error"] is True for r in results)
    assert "same" in results[0]["content"]


@test("any stop reason other than tool_use ends the loop")
def _():
    call_model, seen = scripted(text("The next train is at", stop_reason="max_tokens"))
    assert run_agent(call_model, TOOLS, ask("Next train?")) == "The next train is at"


@test("gives up after max_steps calls instead of looping for ever")
def _():
    loop = [tool_call((f"t{n}", "train_times", {"origin": "York", "destination": "Leeds"}))
            for n in range(20)]
    call_model, seen = scripted(*loop)
    expect(lambda: run_agent(call_model, TOOLS, ask("Next train?"), max_steps=3)).to_raise(RuntimeError)
    assert len(seen) == 3
