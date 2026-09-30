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


def reduce_stream(state: ChatState, event: dict) -> ChatState:
    # Return a new state for each event type. Never change `state` itself.
    if event["type"] == "text-delta":
        state.text += event["text"]
    return state


async def collect(events: AsyncIterable[dict], signal: Signal) -> ChatState:
    # Fold every event with reduce_stream. Handle a cancel, a raised error and a missing "done".
    state = INITIAL_STATE
    async for event in events:
        state = reduce_stream(state, event)
    return state
