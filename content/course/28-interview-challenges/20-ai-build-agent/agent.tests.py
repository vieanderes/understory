import json

from solution import Options, Result, Tool, run_agent


def scripted(replies):
    """A scripted fake model: it returns the replies in order and keeps a copy of what it saw."""
    seen = []

    async def model(messages):
        seen.append([dict(m) for m in messages])
        return replies[min(len(seen) - 1, len(replies) - 1)]

    return model, seen


def call(id, name, input=None):
    return {"type": "tool_calls", "calls": [{"id": id, "name": name, "input": input if input is not None else {}}]}


def final(value):
    return {"type": "final", "text": json.dumps(value)}


GOOD = {"answer": "Room 4 is free at ten.", "sources": ["rooms"]}
FALLBACK = {"answer": "I could not finish that.", "sources": []}


async def refuse_all(call):
    return False


def options(**extra):
    settings = dict(task="Is a room free at ten?", max_steps=5, max_retries=1, approve=refuse_all, fallback=FALLBACK)
    settings.update(extra)
    return Options(**settings)


async def free_rooms(input):
    return "room 4: free at 10:00"


LOOKUP = Tool(run=free_rooms)


@test("a valid final reply ends the run")
async def _():
    model, _seen = scripted([final(GOOD)])
    assert await run_agent(model, {}, options()) == Result("done", GOOD, 1)


@test("a tool result is fed back as a tool message")
async def _():
    model, seen = scripted([call("c1", "rooms", {"time": "10:00"}), final(GOOD)])
    result = await run_agent(model, {"rooms": LOOKUP}, options())
    assert result.status == "done"
    assert result.steps == 2
    assert seen[1][2] == {"role": "tool", "call_id": "c1", "content": "room 4: free at 10:00", "is_error": False}


@test("an unknown tool is refused as an error result, and the run goes on")
async def _():
    model, seen = scripted([call("c1", "delete_all"), final(GOOD)])
    result = await run_agent(model, {"rooms": LOOKUP}, options())
    assert result.status == "done"
    assert seen[1][2] == {"role": "tool", "call_id": "c1", "content": "Unknown tool: delete_all", "is_error": True}


@test("a write tool runs only after approval")
async def _():
    booked = []

    async def book_room(input):
        booked.append(input)
        return "booked"

    book = Tool(run=book_room, write=True)
    asked = []

    async def refuse(c):
        asked.append(c["name"])
        return False

    model, seen = scripted([call("c1", "book", {"room": 4}), final(GOOD)])
    await run_agent(model, {"book": book}, options(approve=refuse))
    assert booked == []
    assert asked == ["book"]
    assert seen[1][2] == {"role": "tool", "call_id": "c1", "content": "Not approved by the user", "is_error": True}

    async def allow(c):
        return True

    model, _seen = scripted([call("c2", "book", {"room": 4}), final(GOOD)])
    await run_agent(model, {"book": book}, options(approve=allow))
    assert booked == [{"room": 4}]


@test("a tool that raises becomes an error result, not a crash")
async def _():
    async def broken_run(input):
        raise RuntimeError("timed out")

    model, seen = scripted([call("c1", "rooms"), final(GOOD)])
    result = await run_agent(model, {"rooms": Tool(run=broken_run)}, options())
    assert result.status == "done"
    assert seen[1][2] == {"role": "tool", "call_id": "c1", "content": "Error: timed out", "is_error": True}


@test("the step cap stops a model that never finishes")
async def _():
    model, seen = scripted([call("c1", "rooms")])
    result = await run_agent(model, {"rooms": LOOKUP}, options(max_steps=3))
    assert result == Result("stopped", FALLBACK, 3)
    assert len(seen) == 3


@test("invalid output is retried with the error, then falls back")
async def _():
    model, seen = scripted([{"type": "final", "text": "Room 4 is free."}, final(GOOD)])
    first = await run_agent(model, {}, options())
    assert first == Result("done", GOOD, 2)
    last_seen = seen[1][-1]
    assert last_seen["role"] == "user"
    assert "Invalid output" in last_seen["content"]
    model, _seen = scripted([final({"answer": "Room 4", "sources": "rooms"})])
    second = await run_agent(model, {}, options(max_retries=2))
    assert second == Result("fallback", FALLBACK, 3)
