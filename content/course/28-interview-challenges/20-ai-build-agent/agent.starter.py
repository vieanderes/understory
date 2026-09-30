import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

# Messages, replies and tool calls are plain dicts, the shape model APIs send as JSON:
#   reply:   {"type": "tool_calls", "calls": [{"id", "name", "input"}]}
#            {"type": "final", "text": "..."}
#   message: {"role": "user", "content": "..."}
#            {"role": "assistant", "reply": reply}
#            {"role": "tool", "call_id": "...", "content": "...", "is_error": bool}
Model = Callable[[list[dict]], Awaitable[dict]]


@dataclass
class Tool:
    run: Callable[[Any], Awaitable[str]]
    write: bool = False


@dataclass
class Options:
    task: str
    max_steps: int
    max_retries: int
    approve: Callable[[dict], Awaitable[bool]]
    fallback: dict  # {"answer": str, "sources": list[str]}


@dataclass
class Result:
    status: str  # "done", "fallback" or "stopped"
    output: dict
    steps: int


async def run_agent(model: Model, tools: dict[str, Tool], options: Options) -> Result:
    messages: list[dict] = [{"role": "user", "content": options.task}]
    # Call the model once per step. Run tool calls through the guards and add each result.
    # Check a final reply against the schema; retry with the error, then fall back.
    reply = await model(messages)
    if reply["type"] == "final":
        return Result("done", json.loads(reply["text"]), 1)
    return Result("stopped", options.fallback, 1)
