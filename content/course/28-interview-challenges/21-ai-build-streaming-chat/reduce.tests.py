import copy
from functools import reduce

from solution import INITIAL_STATE, ChatState, Signal, ToolCallState, collect, reduce_stream


def fold(events):
    return reduce(reduce_stream, events, INITIAL_STATE)


async def stream(events):
    for event in events:
        yield event


@test("text deltas join into one message")
def _():
    state = fold([
        {"type": "text-delta", "text": "Your table "},
        {"type": "text-delta", "text": "is booked."},
        {"type": "done"},
    ])
    assert state == ChatState(status="done", text="Your table is booked.", tool_calls=[], error=None, can_retry=False)


@test("tool-call arguments are parsed only once the call ends")
def _():
    midway = fold([
        {"type": "tool-call-start", "id": "t1", "name": "weather"},
        {"type": "tool-call-delta", "id": "t1", "args_delta": '{"city": "Le'},
        {"type": "tool-call-delta", "id": "t1", "args_delta": 'eds"}'},
    ])
    assert midway.tool_calls == [ToolCallState("t1", "weather", '{"city": "Leeds"}', None, False)]
    ended = reduce_stream(midway, {"type": "tool-call-end", "id": "t1"})
    assert ended.tool_calls[0].args == {"city": "Leeds"}
    assert ended.tool_calls[0].complete is True


@test("two tool calls stream side by side without mixing")
def _():
    state = fold([
        {"type": "tool-call-start", "id": "a", "name": "stock"},
        {"type": "tool-call-start", "id": "b", "name": "price"},
        {"type": "tool-call-delta", "id": "b", "args_delta": '{"sku":'},
        {"type": "tool-call-delta", "id": "a", "args_delta": '{"sku": 7}'},
        {"type": "tool-call-delta", "id": "b", "args_delta": " 9}"},
        {"type": "tool-call-end", "id": "a"},
        {"type": "tool-call-end", "id": "b"},
    ])
    assert [c.args for c in state.tool_calls] == [{"sku": 7}, {"sku": 9}]


@test("the reducer never changes the state it is given")
def _():
    before = fold([{"type": "text-delta", "text": "Hi"}, {"type": "tool-call-start", "id": "a", "name": "stock"}])
    snapshot = copy.deepcopy(before)
    reduce_stream(before, {"type": "text-delta", "text": " there"})
    reduce_stream(before, {"type": "tool-call-delta", "id": "a", "args_delta": "{}"})
    assert before == snapshot
    assert INITIAL_STATE == ChatState()


@test("an error event keeps the text and offers a retry, and later events are ignored")
def _():
    state = fold([
        {"type": "text-delta", "text": "The venue opens"},
        {"type": "error", "message": "overloaded"},
        {"type": "text-delta", "text": " at six."},
    ])
    assert state == ChatState(status="error", text="The venue opens", tool_calls=[], error="overloaded", can_retry=True)


@test("cancelling keeps the partial text, even when the read then raises")
async def _():
    signal = Signal()

    async def user_stops():
        yield {"type": "text-delta", "text": "Hel"}
        yield {"type": "text-delta", "text": "lo"}
        signal.aborted = True
        yield {"type": "text-delta", "text": " there"}

    first = await collect(user_stops(), signal)
    assert first == ChatState(status="cancelled", text="Hello", tool_calls=[], error=None, can_retry=True)

    aborted = Signal()

    async def read_raises():
        yield {"type": "text-delta", "text": "Checking"}
        aborted.aborted = True
        raise ConnectionError("The operation was aborted")

    second = await collect(read_raises(), aborted)
    assert second.status == "cancelled"
    assert second.text == "Checking"


@test("a dropped connection or a stream with no done is an error with a retry")
async def _():
    async def drops():
        yield {"type": "text-delta", "text": "Two seats"}
        raise ConnectionError("network lost")

    assert await collect(drops(), Signal()) == ChatState(
        status="error", text="Two seats", tool_calls=[], error="network lost", can_retry=True
    )
    ended = await collect(stream([{"type": "text-delta", "text": "Two"}]), Signal())
    assert ended.status == "error"
    assert ended.can_retry is True
    assert ended.text == "Two"
