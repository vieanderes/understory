import json
from collections.abc import AsyncIterable
from dataclasses import dataclass, field, replace
from typing import Any

# Events are dicts, the shape a streaming API sends as JSON:
#   {"type": "text-delta", "text": str}
#   {"type": "tool-call-start", "id": str, "name": str}
#   {"type": "tool-call-delta", "id": str, "args_delta": str}
#   {"type": "tool-call-end", "id": str}
#   {"type": "done"}
#   {"type": "error", "message": str}


@dataclass
class ToolCallState:
    id: str
    name: str
    args_text: str = ""
    args: Any = None
    complete: bool = False


@dataclass
class ChatState:
    status: str = "streaming"  # "streaming", "done", "cancelled" or "error"
    text: str = ""
    tool_calls: list[ToolCallState] = field(default_factory=list)
    error: str | None = None
    can_retry: bool = False


@dataclass
class Signal:
    """Set `aborted` to stop a stream, as the user pressing Stop would."""

    aborted: bool = False


INITIAL_STATE = ChatState()


def fail(state: ChatState, message: str) -> ChatState:
    return replace(state, status="error", error=message, can_retry=True)


def reduce_stream(state: ChatState, event: dict) -> ChatState:
    # A finished message ignores stragglers, such as events from a stream that was cancelled.
    if state.status != "streaming":
        return state
    match event["type"]:
        case "text-delta":
            return replace(state, text=state.text + event["text"])
        case "tool-call-start":
            call = ToolCallState(event["id"], event["name"])
            return replace(state, tool_calls=[*state.tool_calls, call])
        case "tool-call-delta":
            calls = [
                replace(c, args_text=c.args_text + event["args_delta"]) if c.id == event["id"] else c
                for c in state.tool_calls
            ]
            return replace(state, tool_calls=calls)
        case "tool-call-end":
            call = next((c for c in state.tool_calls if c.id == event["id"]), None)
            if call is None:
                return state
            # Fragments are rarely valid JSON on their own, so arguments are parsed once, at the end.
            try:
                args = json.loads(call.args_text or "{}")
            except json.JSONDecodeError:
                return fail(state, f"Invalid arguments for {call.name}")
            calls = [replace(c, args=args, complete=True) if c.id == event["id"] else c for c in state.tool_calls]
            return replace(state, tool_calls=calls)
        case "done":
            return replace(state, status="done")
        case "error":
            return fail(state, event["message"])
    return state


def cancelled(state: ChatState) -> ChatState:
    return replace(state, status="cancelled", can_retry=True)


async def collect(events: AsyncIterable[dict], signal: Signal) -> ChatState:
    state = INITIAL_STATE
    try:
        async for event in events:
            if signal.aborted:
                return cancelled(state)
            state = reduce_stream(state, event)
            if state.status != "streaming":
                return state
    except Exception as error:
        # Aborting a request makes the read raise, so a raise after an abort is a cancel.
        if signal.aborted:
            return cancelled(state)
        return fail(state, str(error))
    if signal.aborted:
        return cancelled(state)
    return fail(state, "The stream ended early")
